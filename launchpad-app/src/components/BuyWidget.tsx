"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type Address, type Hex, formatUnits, parseUnits, zeroAddress } from "viem";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { launchpadAbi } from "@/lib/abis";
import { chain, quoteTokenByAddress } from "@/lib/config";
import { formatCompact } from "@/lib/format";
import { SWAP_ROUTER, V4_QUOTER, erc20Abi, isZeroForOne, poolIdOf, poolKeyFor, quoterAbi, swapRouterAbi } from "@/lib/swap";
import { ConnectButton } from "./ConnectButton";
import { Button, Card, Input, Notice } from "./ui";

const SLIPPAGE_PERCENT = 5n;
const DEADLINE_SECONDS = 600;

const errorMessage = (cause: unknown) =>
  (cause as { shortMessage?: string }).shortMessage ?? (cause instanceof Error ? cause.message : "Something went wrong");

const parseAmount = (value: string, decimals: number) => {
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
};

const secondsFromNow = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;

type BuyableToken = { id: string; symbol: string; quoteToken: string; poolId: string; hooks: string };

export function BuyWidget({ token, launchpad }: { token: BuyableToken; launchpad: Address }) {
  const router = useRouter();
  const { address: account, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<string>();
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string }>();

  const quoteToken = quoteTokenByAddress(token.quoteToken);
  const config = useReadContract({ address: launchpad, abi: launchpadAbi, functionName: "config" });
  const poolKey =
    config.data && poolKeyFor(token.id as Address, token.quoteToken as Address, config.data[2], config.data[3], token.hooks as Address);
  const isPoolKnown = Boolean(poolKey && poolIdOf(poolKey) === token.poolId);
  const amountIn = quoteToken ? parseAmount(amount, quoteToken.decimals) : 0n;

  const quote = useQuery({
    queryKey: ["quote", token.id, amountIn.toString()],
    enabled: Boolean(isPoolKnown && amountIn > 0n && publicClient),
    queryFn: async () => {
      const { result } = await publicClient!.simulateContract({
        address: V4_QUOTER,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            poolKey: poolKey!,
            zeroForOne: isZeroForOne(poolKey!, token.quoteToken as Address),
            exactAmount: amountIn,
            hookData: "0x",
          },
        ],
      });
      return result[0];
    },
  });

  if (!quoteToken) return null;

  const confirm = async (hash: Hex) => {
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
  };

  const approveQuoteToken = async () => {
    const allowance = await publicClient!.readContract({
      address: quoteToken.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account!, SWAP_ROUTER],
    });
    if (allowance >= amountIn) return;
    setStep(`Approve ${quoteToken.symbol} in your wallet…`);
    await confirm(
      await writeContractAsync({ address: quoteToken.address, abi: erc20Abi, functionName: "approve", args: [SWAP_ROUTER, amountIn] }),
    );
  };

  const buy = async (event: FormEvent) => {
    event.preventDefault();
    if (!poolKey || !quote.data) return;
    setStatus(undefined);
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      const paysWithNativeEth = quoteToken.address === zeroAddress;
      if (!paysWithNativeEth) await approveQuoteToken();

      const minimumOut = (quote.data * (100n - SLIPPAGE_PERCENT)) / 100n;
      setStep("Confirm the swap in your wallet…");
      await confirm(
        await writeContractAsync({
          address: SWAP_ROUTER,
          abi: swapRouterAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            amountIn,
            minimumOut,
            isZeroForOne(poolKey, quoteToken.address),
            poolKey,
            "0x",
            account!,
            BigInt(secondsFromNow(DEADLINE_SECONDS)),
          ],
          value: paysWithNativeEth ? amountIn : 0n,
        }),
      );
      setStatus({ tone: "success", text: `Bought ${token.symbol}. The trade shows up below in a few seconds.` });
      setAmount("");
      router.refresh();
    } catch (cause) {
      setStatus({ tone: "danger", text: errorMessage(cause) });
    } finally {
      setStep(undefined);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="heading text-lg">Buy {token.symbol}</h2>
      {config.data && !isPoolKnown ? (
        <Notice tone="muted">
          This token was launched with pool settings that have since changed, so it cannot be bought here. Trade it on any Uniswap v4
          interface.
        </Notice>
      ) : (
        <form onSubmit={buy} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted">You pay, {quoteToken.symbol}</span>
            <Input inputMode="decimal" placeholder="0.0" value={amount} disabled={Boolean(step)} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">You receive</span>
            <span className="font-medium">
              {quote.data
                ? `≈ ${formatCompact(Number(formatUnits(quote.data, 18)))} ${token.symbol}`
                : quote.isError
                  ? "No quote for this amount"
                  : quote.isFetching
                    ? "Quoting…"
                    : "—"}
            </span>
          </div>
          {isConnected ? (
            <Button type="submit" disabled={Boolean(step) || !quote.data}>
              Buy {token.symbol}
            </Button>
          ) : (
            <ConnectButton />
          )}
          <p className="text-xs text-muted">Exact-input swap on Uniswap v4 with {SLIPPAGE_PERCENT.toString()}% slippage tolerance.</p>
          {step && <Notice tone="muted">{step}</Notice>}
          {status && <Notice tone={status.tone}>{status.text}</Notice>}
        </form>
      )}
    </Card>
  );
}
