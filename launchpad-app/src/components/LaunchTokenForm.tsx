"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { type Address, type Hex, formatUnits, parseEventLogs } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSignMessage,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { launchpadAbi } from "@/lib/abis";
import { chain, quoteTokens } from "@/lib/config";
import { formatCompact, formatUsdPrecise } from "@/lib/format";
import { type TokenLinks, type TokenMetadata, tokenMetadataError, tokenMetadataMessage } from "@/lib/tokenMetadata";
import { ConnectButton } from "./ConnectButton";
import { LaunchpadLogo } from "./LaunchpadLogo";
import { LogoDropzone } from "./LogoDropzone";
import { Button, Card, Field, Input, Notice, Textarea } from "./ui";

type LaunchedToken = { address: Address; launchTxHash: Hex };

const NO_LINKS: TokenLinks = { website: "", twitter: "", telegram: "" };
const LINK_PLACEHOLDERS: Record<keyof TokenLinks, string> = {
  website: "https://yourproject.xyz",
  twitter: "https://x.com/yourproject",
  telegram: "https://t.me/yourproject",
};

const errorMessage = (cause: unknown) =>
  (cause as { shortMessage?: string }).shortMessage ?? (cause instanceof Error ? cause.message : "Something went wrong");

const saveTokenDetails = async (metadata: TokenMetadata, launchTxHash: Hex, sign: (message: string) => Promise<Hex>) => {
  const issuedAt = Date.now();
  const signature = await sign(tokenMetadataMessage(metadata, issuedAt));
  const response = await fetch("/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ metadata, issuedAt, signature, launchTxHash }),
  });
  if (!response.ok) throw new Error((await response.json()).error);
};

function SectionTitle({ index, children }: { index: string; children: ReactNode }) {
  return (
    <h2 className="heading flex items-center gap-3 text-lg">
      <span className="rounded-lg bg-raised px-2 py-1 font-mono text-xs text-brand">{index}</span>
      {children}
    </h2>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function LaunchTokenForm({ launchpad, accentColor }: { launchpad: Address; accentColor: string }) {
  const router = useRouter();
  const { chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const config = useReadContract({ address: launchpad, abi: launchpadAbi, functionName: "config" });
  const quoteFlags = useReadContracts({
    allowFailure: false,
    contracts: quoteTokens.map(
      (quoteToken) =>
        ({ address: launchpad, abi: launchpadAbi, functionName: "isQuoteEnabled", args: [quoteToken.address] }) as const,
    ),
  });
  const enabledQuoteTokens = quoteTokens.filter((_, index) => quoteFlags.data?.[index]);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [chosenQuoteToken, setChosenQuoteToken] = useState<Address>();
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [links, setLinks] = useState(NO_LINKS);
  const [launched, setLaunched] = useState<LaunchedToken>();
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();

  const quoteToken = enabledQuoteTokens.find(({ address }) => address === chosenQuoteToken) ?? enabledQuoteTokens[0];
  const hasDetails = Boolean(description.trim() || imageUrl || Object.values(links).some(Boolean));

  const [totalSupply, initialMarketcap] = config.data ?? [];
  const wholeSupply = totalSupply ? Number(formatUnits(totalSupply, 18)) : undefined;
  const launchCapUsd = initialMarketcap ? Number(formatUnits(initialMarketcap, 18)) : undefined;

  const launch = async (): Promise<LaunchedToken> => {
    if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
    setStep("Confirm the transaction in your wallet…");
    const launchTxHash = await writeContractAsync({
      address: launchpad,
      abi: launchpadAbi,
      functionName: "launchToken",
      args: [name.trim(), symbol.trim().toUpperCase(), quoteToken!.address],
    });
    setStep("Launching your token…");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash: launchTxHash });
    const [log] = parseEventLogs({ abi: launchpadAbi, eventName: "TokenLaunched", logs: receipt.logs });
    return { address: log.args.token, launchTxHash };
  };

  const saveDetails = (token: LaunchedToken) => {
    setStep("Sign the token details in your wallet…");
    return saveTokenDetails({ address: token.address, description, imageUrl, ...links }, token.launchTxHash, (message) =>
      signMessageAsync({ message }),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!quoteToken) return setError("This launchpad has no paired assets enabled");
    const invalid = tokenMetadataError({ address: launchpad, description, imageUrl, ...links });
    if (invalid) return setError(invalid);
    setError(undefined);

    try {
      const token = launched ?? (await launch());
      setLaunched(token);
      if (hasDetails) await saveDetails(token);
      router.push(`/tokens/${token.address}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setStep(undefined);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <div>
        <h1 className="heading text-3xl sm:text-4xl">Launch a Token</h1>
        <p className="mt-2 text-muted">Mint a fixed-supply token and seed its Uniswap v4 pool in one transaction.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={Boolean(step)} className="flex min-w-0 flex-col gap-6 disabled:opacity-60">
          <SectionTitle index="01">Token Identity</SectionTitle>

          <div className="flex flex-col gap-5 sm:flex-row">
            <LogoDropzone value={imageUrl} onChange={setImageUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <Field label="Token Name *">
                <Input
                  required
                  disabled={Boolean(launched)}
                  maxLength={50}
                  placeholder="Token name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Token Symbol *">
                <Input
                  required
                  disabled={Boolean(launched)}
                  maxLength={12}
                  placeholder="TOKEN"
                  className="uppercase"
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <Field label="Paired Asset *" hint="The asset your buyers pay with.">
            <select
              disabled={Boolean(launched)}
              className="h-11 w-full rounded-xl border border-line bg-ink px-4 text-sm text-white outline-none focus:border-brand"
              value={quoteToken?.address ?? ""}
              onChange={(event) => setChosenQuoteToken(event.target.value as Address)}
            >
              {enabledQuoteTokens.length === 0 && <option value="">{quoteFlags.isPending ? "Loading…" : "None enabled"}</option>}
              {enabledQuoteTokens.map((enabled) => (
                <option key={enabled.address} value={enabled.address}>
                  {enabled.symbol}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <Textarea
              maxLength={500}
              placeholder="What is this token about?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Links (optional)</span>
            {(Object.keys(LINK_PLACEHOLDERS) as (keyof TokenLinks)[]).map((field) => (
              <Input
                key={field}
                type="url"
                placeholder={LINK_PLACEHOLDERS[field]}
                value={links[field]}
                onChange={(event) => setLinks({ ...links, [field]: event.target.value })}
              />
            ))}
          </div>

          <ul className="flex list-disc flex-col gap-2 rounded-2xl border border-line bg-surface/80 p-5 pl-9 text-sm text-muted marker:text-brand">
            <li>The token and its Uniswap v4 pool go live together, priced in {quoteToken?.symbol ?? "the paired asset"}.</li>
            <li>The fixed supply is minted once and seeded into the pool as token-only liquidity.</li>
            <li>The token has no admin: nobody can mint more, pause transfers, or seize balances.</li>
            <li>Logo, description, and links are stored offchain and take one extra signature, not a transaction.</li>
          </ul>
        </fieldset>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="flex flex-col gap-4 p-5">
            <p className="text-xs text-muted">Live preview</p>
            <div className="flex items-center gap-3">
              <LaunchpadLogo name={name || "T"} logoUrl={imageUrl} accentColor={accentColor} size={48} />
              <div className="min-w-0">
                <p className="heading truncate">{name || "Your token"}</p>
                <p className="truncate text-xs text-muted">
                  {symbol.toUpperCase() || "TOKEN"}/{quoteToken?.symbol ?? "—"}
                </p>
              </div>
              <span className="ml-auto rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand">NEW</span>
            </div>
            <p className="truncate text-sm text-muted">{description || "Fixed-supply token trading on a Uniswap v4 pool."}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-muted">Start price</dt>
                <dd className="font-medium">
                  {launchCapUsd && wholeSupply ? `≈ ${formatUsdPrecise(launchCapUsd / wholeSupply)}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Launch cap</dt>
                <dd className="font-medium">{launchCapUsd ? `≈ $${formatCompact(launchCapUsd)}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Fixed supply</dt>
                <dd className="font-medium">{wholeSupply ? formatCompact(wholeSupply) : "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <dl className="flex flex-col gap-3">
              <SummaryRow label="Fixed supply" value={wholeSupply ? formatCompact(wholeSupply) : "—"} />
              <SummaryRow label="Pool model" value="Uniswap v4, token-only" />
              <SummaryRow label="Launch market cap" value={launchCapUsd ? `≈ $${formatCompact(launchCapUsd)}` : "—"} />
              <SummaryRow label="Paired asset" value={quoteToken?.symbol ?? "—"} />
            </dl>
            {isConnected ? (
              <Button type="submit" disabled={Boolean(step)} className="w-full">
                {launched ? "Save Token Details" : "Launch Token"}
              </Button>
            ) : (
              <ConnectButton />
            )}
            {step && <Notice tone="muted">{step}</Notice>}
            {error && <Notice tone="danger">{error}</Notice>}
            {launched && !step && (
              <Notice tone="muted">
                Your token is live at {launched.address}. Only its details are left to save.{" "}
                <Link href={`/tokens/${launched.address}`} className="underline hover:text-white">
                  Skip
                </Link>
              </Notice>
            )}
          </Card>
        </aside>
      </div>
    </form>
  );
}
