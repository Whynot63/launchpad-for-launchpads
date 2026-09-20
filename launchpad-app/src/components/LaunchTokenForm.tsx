"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type Address, parseEventLogs } from "viem";
import { useAccount, usePublicClient, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { launchpadAbi } from "@/lib/abis";
import { chain, quoteTokens } from "@/lib/config";
import { ConnectButton } from "./ConnectButton";
import { Button, Card, Field, Input, Notice } from "./ui";

const errorMessage = (cause: unknown) =>
  (cause as { shortMessage?: string }).shortMessage ?? (cause instanceof Error ? cause.message : "Something went wrong");

export function LaunchTokenForm({ launchpad, launchpadName }: { launchpad: Address; launchpadName: string }) {
  const router = useRouter();
  const { chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

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
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();

  const quoteToken = chosenQuoteToken ?? enabledQuoteTokens[0]?.address;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!quoteToken) return setError("This launchpad has no quote tokens enabled");
    setError(undefined);
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      setStep("Confirm the transaction in your wallet…");
      const hash = await writeContractAsync({
        address: launchpad,
        abi: launchpadAbi,
        functionName: "launchToken",
        args: [name.trim(), symbol.trim().toUpperCase(), quoteToken],
      });
      setStep("Launching your token…");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      const [log] = parseEventLogs({ abi: launchpadAbi, eventName: "TokenLaunched", logs: receipt.logs });
      router.push(`/tokens/${log.args.token}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setStep(undefined);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <p className="eyebrow">{launchpadName}</p>
        <h1 className="heading mt-2 text-3xl">Launch Token</h1>
        <p className="mt-2 text-muted">
          One transaction creates the token and its Uniswap v4 pool. It is tradable everywhere right away.
        </p>
      </div>

      <Card className="flex flex-col gap-5">
        <Field label="Name">
          <Input required maxLength={50} placeholder="Agent Smith" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Symbol">
          <Input
            required
            maxLength={12}
            placeholder="SMITH"
            className="uppercase"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
          />
        </Field>
        <Field label="Trade Against" hint="The token your buyers pay with.">
          <select
            className="h-11 w-full rounded-xl border border-line bg-ink px-4 text-sm text-white outline-none focus:border-brand"
            value={quoteToken ?? ""}
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
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        {isConnected ? (
          <Button type="submit" disabled={Boolean(step)}>
            Launch Token
          </Button>
        ) : (
          <ConnectButton />
        )}
        {step && <Notice tone="muted">{step}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </form>
  );
}
