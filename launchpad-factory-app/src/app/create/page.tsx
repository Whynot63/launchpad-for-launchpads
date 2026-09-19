"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type Address, type Hex, encodeFunctionData, parseEventLogs } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { BrandingFields, EMPTY_BRANDING } from "@/components/BrandingFields";
import { ConnectButton } from "@/components/ConnectButton";
import { LaunchSettingsFields } from "@/components/LaunchSettingsFields";
import { Button, Card, Notice } from "@/components/ui";
import { launchpadAbi, launchpadFactoryAbi } from "@/lib/abis";
import { chain, factoryAddress, quoteTokens } from "@/lib/config";
import { DEFAULT_LAUNCH_SETTINGS, launchSettingsError, toLaunchConfig } from "@/lib/launchSettings";
import { metadataError } from "@/lib/metadata";
import { errorMessage, useSaveBranding } from "@/lib/useSaveBranding";

type CreatedLaunchpad = { address: Address; creationTxHash: Hex };

const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function CreateLaunchpadPage() {
  const router = useRouter();
  const { address: account, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const saveBranding = useSaveBranding();

  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [settings, setSettings] = useState(DEFAULT_LAUNCH_SETTINGS);
  const [enabledQuoteTokens, setEnabledQuoteTokens] = useState<Address[]>([quoteTokens[0].address]);
  const [created, setCreated] = useState<CreatedLaunchpad>();
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();

  const deploy = async (): Promise<CreatedLaunchpad> => {
    if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
    setStep("Confirm the transaction in your wallet…");
    const creationTxHash = await writeContractAsync({
      address: factoryAddress,
      abi: launchpadFactoryAbi,
      functionName: "createLaunchpad",
      args: [
        encodeFunctionData({
          abi: launchpadAbi,
          functionName: "initialize",
          args: [account!, toLaunchConfig(settings), enabledQuoteTokens],
        }),
      ],
    });
    setStep("Deploying your launchpad…");
    const receipt = await publicClient!.waitForTransactionReceipt({ hash: creationTxHash });
    const [log] = parseEventLogs({ abi: launchpadFactoryAbi, eventName: "LaunchpadCreated", logs: receipt.logs });
    return { address: log.args.launchpad, creationTxHash };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid =
      metadataError({ ...branding, address: PLACEHOLDER_ADDRESS }) ??
      launchSettingsError(settings) ??
      (enabledQuoteTokens.length === 0 ? "Enable at least one quote token" : null);
    if (invalid) return setError(invalid);
    setError(undefined);

    try {
      if (!created) {
        const taken = await fetch(`/api/launchpads/${branding.slug}`);
        if (taken.ok) return setError("This subdomain is already taken");
      }
      const launchpad = created ?? (await deploy());
      setCreated(launchpad);
      setStep("Sign the branding message in your wallet…");
      await saveBranding({ ...branding, address: launchpad.address }, launchpad.creationTxHash);
      router.push(`/launchpads/${launchpad.address}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setStep(undefined);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="eyebrow">New Launchpad</p>
        <h1 className="heading mt-2 text-3xl">Create Launchpad</h1>
        <p className="mt-2 text-muted">A name and a subdomain are enough. Everything else has sensible defaults you can change later.</p>
      </div>

      <Card>
        <BrandingFields value={branding} onChange={setBranding} deriveSlugFromName={!created} />
      </Card>

      <details className="group rounded-2xl border border-line bg-surface/80 backdrop-blur">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium">
          Launch Settings <span className="text-muted group-open:hidden">— defaults: 1B supply, $5K market cap, 1% fee, ETH, default hook</span>
        </summary>
        <fieldset disabled={Boolean(created)} className="flex flex-col gap-5 border-t border-line p-6 disabled:opacity-60">
          <LaunchSettingsFields value={settings} onChange={setSettings} />
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Quote Tokens</span>
            <div className="flex flex-wrap gap-3">
              {quoteTokens.map((quoteToken) => (
                <label key={quoteToken.address} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2">
                  <input
                    type="checkbox"
                    className="accent-brand"
                    checked={enabledQuoteTokens.includes(quoteToken.address)}
                    onChange={(event) =>
                      setEnabledQuoteTokens((enabled) =>
                        event.target.checked
                          ? [...enabled, quoteToken.address]
                          : enabled.filter((address) => address !== quoteToken.address),
                      )
                    }
                  />
                  {quoteToken.symbol}
                </label>
              ))}
            </div>
          </div>
        </fieldset>
      </details>

      <div className="flex flex-wrap items-center gap-4">
        {isConnected ? (
          <Button type="submit" disabled={Boolean(step)}>
            {created ? "Save Branding" : "Create Launchpad"}
          </Button>
        ) : (
          <ConnectButton />
        )}
        {step && <Notice tone="muted">{step}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
      {created && !step && (
        <Notice tone="muted">
          Your launchpad is deployed at {created.address}. Only its branding is left to save — no new transaction needed.
        </Notice>
      )}
    </form>
  );
}
