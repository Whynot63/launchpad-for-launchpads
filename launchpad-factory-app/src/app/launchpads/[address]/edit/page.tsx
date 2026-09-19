"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";
import { type Address, isAddressEqual } from "viem";
import { useAccount, usePublicClient, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { BrandingFields, type BrandingForm } from "@/components/BrandingFields";
import { ConnectButton } from "@/components/ConnectButton";
import { LaunchSettingsFields } from "@/components/LaunchSettingsFields";
import { Button, Card, Notice } from "@/components/ui";
import { launchpadAbi } from "@/lib/abis";
import { chain, quoteTokens } from "@/lib/config";
import { type LaunchSettingsForm, launchSettingsError, toLaunchConfig, toLaunchSettingsForm } from "@/lib/launchSettings";
import { type StoredLaunchpad, metadataError } from "@/lib/metadata";
import { errorMessage, useSaveBranding } from "@/lib/useSaveBranding";

type Status = { tone: "muted" | "success" | "danger"; text: string };

export default function EditLaunchpadPage({ params }: PageProps<"/launchpads/[address]/edit">) {
  const launchpad = use(params).address as Address;

  const stored = useQuery({
    queryKey: ["launchpad", launchpad],
    queryFn: async (): Promise<StoredLaunchpad> => (await fetch(`/api/launchpads/${launchpad}`)).json(),
  });
  const onchain = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: launchpad, abi: launchpadAbi, functionName: "owner" },
      { address: launchpad, abi: launchpadAbi, functionName: "config" },
    ],
  });
  const quoteFlags = useReadContracts({
    allowFailure: false,
    contracts: quoteTokens.map(
      (quoteToken) =>
        ({ address: launchpad, abi: launchpadAbi, functionName: "isQuoteEnabled", args: [quoteToken.address] }) as const,
    ),
  });

  if (!stored.data || !onchain.data || !quoteFlags.data) {
    return <Notice tone="muted">{stored.isError || onchain.isError ? "Launchpad not found." : "Loading…"}</Notice>;
  }

  const [owner, [totalSupply, initialMarketcap, poolFee, tickSpacing, hooks]] = onchain.data;
  return (
    <EditLaunchpadForm
      launchpad={launchpad}
      owner={owner}
      initialBranding={stored.data}
      initialSettings={toLaunchSettingsForm({ totalSupply, initialMarketcap, poolFee, tickSpacing, hooks })}
      isQuoteEnabled={quoteFlags.data}
      refetchOnchain={() => Promise.all([onchain.refetch(), quoteFlags.refetch()])}
    />
  );
}

function EditLaunchpadForm({
  launchpad,
  owner,
  initialBranding,
  initialSettings,
  isQuoteEnabled,
  refetchOnchain,
}: {
  launchpad: Address;
  owner: Address;
  initialBranding: BrandingForm;
  initialSettings: LaunchSettingsForm;
  isQuoteEnabled: boolean[];
  refetchOnchain: () => Promise<unknown>;
}) {
  const { address: account, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const saveBranding = useSaveBranding();

  const [branding, setBranding] = useState(initialBranding);
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<Status>();

  const isOwner = Boolean(account && isAddressEqual(account, owner));

  const run = async (pending: string, done: string, action: () => Promise<unknown>) => {
    setStatus({ tone: "muted", text: pending });
    try {
      await action();
      setStatus({ tone: "success", text: done });
    } catch (cause) {
      setStatus({ tone: "danger", text: errorMessage(cause) });
    }
  };

  const send = async (request: Parameters<typeof writeContractAsync>[0]) => {
    if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
    const hash = await writeContractAsync(request);
    await publicClient!.waitForTransactionReceipt({ hash });
    await refetchOnchain();
  };

  const submitBranding = () => {
    const invalid = metadataError({ ...branding, address: launchpad });
    if (invalid) return setStatus({ tone: "danger", text: invalid });
    run("Sign the branding message in your wallet…", "Branding saved.", () => saveBranding({ ...branding, address: launchpad }));
  };

  const submitSettings = () => {
    const invalid = launchSettingsError(settings);
    if (invalid) return setStatus({ tone: "danger", text: invalid });
    run("Confirm the transaction in your wallet…", "Launch settings updated. They apply to the next launches.", () =>
      send({ address: launchpad, abi: launchpadAbi, functionName: "setConfig", args: [toLaunchConfig(settings)] }),
    );
  };

  const toggleQuoteToken = (quoteToken: Address, enabled: boolean) =>
    run("Confirm the transaction in your wallet…", "Quote tokens updated.", () =>
      send({ address: launchpad, abi: launchpadAbi, functionName: "setQuoteEnabled", args: [quoteToken, enabled] }),
    );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href={`/launchpads/${launchpad}`} className="text-sm text-muted hover:text-white">
          ← {branding.name}
        </Link>
        <h1 className="heading mt-2 text-3xl">Edit Launchpad</h1>
      </div>

      {!isConnected && <ConnectButton />}
      {isConnected && !isOwner && <Notice tone="danger">Only the launchpad owner can edit it. Connect the owner wallet.</Notice>}
      {status && <Notice tone={status.tone}>{status.text}</Notice>}

      <fieldset disabled={!isOwner || status?.tone === "muted"} className="flex flex-col gap-6 disabled:opacity-60">
        <Card className="flex flex-col gap-5">
          <div>
            <h2 className="heading text-lg">Branding</h2>
            <p className="text-sm text-muted">Stored offchain. Saving takes a signature, not a transaction.</p>
          </div>
          <BrandingFields value={branding} onChange={setBranding} deriveSlugFromName={false} />
          <Button type="button" className="self-start" onClick={submitBranding}>
            Save Branding
          </Button>
        </Card>

        <Card className="flex flex-col gap-5">
          <div>
            <h2 className="heading text-lg">Launch Settings</h2>
            <p className="text-sm text-muted">Stored onchain. Changes apply to tokens launched after the update.</p>
          </div>
          <LaunchSettingsFields value={settings} onChange={setSettings} />
          <Button type="button" className="self-start" onClick={submitSettings}>
            Update Launch Settings
          </Button>
        </Card>

        <Card className="flex flex-col gap-5">
          <div>
            <h2 className="heading text-lg">Quote Tokens</h2>
            <p className="text-sm text-muted">Tokens that launches on this launchpad can be paired with.</p>
          </div>
          <ul className="flex flex-col gap-3">
            {quoteTokens.map((quoteToken, index) => (
              <li key={quoteToken.address} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                <span>
                  {quoteToken.symbol}{" "}
                  <span className={isQuoteEnabled[index] ? "text-success" : "text-muted"}>
                    {isQuoteEnabled[index] ? "enabled" : "disabled"}
                  </span>
                </span>
                <Button type="button" variant="secondary" onClick={() => toggleQuoteToken(quoteToken.address, !isQuoteEnabled[index])}>
                  {isQuoteEnabled[index] ? "Disable" : "Enable"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </fieldset>
    </div>
  );
}
