"use client";

import { useState } from "react";
import { type Address, type Hex, formatUnits, isAddressEqual } from "viem";
import { useAccount, usePublicClient, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { feeHookAbi } from "@/lib/abis";
import { type QuoteToken, chain } from "@/lib/config";
import { Button, Card, Notice } from "./ui";

const errorMessage = (cause: unknown) =>
  (cause as { shortMessage?: string }).shortMessage ?? (cause instanceof Error ? cause.message : "Something went wrong");

export function ClaimFees({
  title,
  hook,
  feeAccount,
  claimer,
  quoteTokens,
}: {
  title: string;
  hook: Address;
  feeAccount: Address;
  claimer: Address;
  quoteTokens: QuoteToken[];
}) {
  const { address: account, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [claiming, setClaiming] = useState<Address>();
  const [error, setError] = useState<string>();

  const fees = useReadContracts({
    allowFailure: false,
    contracts: quoteTokens.map(
      (quoteToken) =>
        ({ address: hook, abi: feeHookAbi, functionName: "collectableFees", args: [feeAccount, quoteToken.address] }) as const,
    ),
  });

  if (!account || !isAddressEqual(account, claimer) || !fees.data) return null;

  const confirm = async (hash: Hex) => {
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
  };

  const claim = async (quoteToken: QuoteToken) => {
    setError(undefined);
    setClaiming(quoteToken.address);
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      await confirm(
        await writeContractAsync({
          address: hook,
          abi: feeHookAbi,
          functionName: "collectFees",
          args: [feeAccount, quoteToken.address, account],
        }),
      );
      await fees.refetch();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setClaiming(undefined);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="heading text-lg">{title}</h2>
      <ul className="flex flex-col gap-3">
        {quoteTokens.map((quoteToken, index) => (
          <li key={quoteToken.address} className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium">
              {formatUnits(fees.data[index], quoteToken.decimals)} {quoteToken.symbol}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={fees.data[index] === 0n || Boolean(claiming)}
              onClick={() => claim(quoteToken)}
            >
              {claiming === quoteToken.address ? "Claiming…" : "Claim Fees"}
            </Button>
          </li>
        ))}
      </ul>
      {error && <Notice tone="danger">{error}</Notice>}
    </Card>
  );
}
