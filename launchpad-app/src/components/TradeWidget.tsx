"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type Address, type Hex, formatUnits, parseUnits, zeroAddress } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { launchpadAbi } from "@/lib/abis";
import { type QuoteToken, chain } from "@/lib/config";
import { formatCompact } from "@/lib/format";
import { SWAP_ROUTER, V4_QUOTER, erc20Abi, isZeroForOne, poolIdOf, poolKeyFor, quoterAbi, swapRouterAbi } from "@/lib/swap";
import { ConnectButton } from "./ConnectButton";
import { Button, Card, Input, Notice } from "./ui";

const SLIPPAGE_PERCENT = 5n;
const DEADLINE_SECONDS = 600;
const TOKEN_DECIMALS = 18;

type Side = "buy" | "sell";
type Currency = { address: Address; symbol: string; decimals: number };
type TradableToken = { id: string; symbol: string; quoteToken: string; poolId: string; hooks: string };

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

const formatAmount = (amount: bigint, currency: Currency) =>
  `${formatCompact(Number(formatUnits(amount, currency.decimals)))} ${currency.symbol}`;

export function TradeWidget({
  token,
  quoteToken: quoteCurrency,
  launchpad,
}: {
  token: TradableToken;
  quoteToken: QuoteToken | undefined;
  launchpad: Address;
}) {
  const router = useRouter();
  const { address: account, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<string>();
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string }>();

  const tokenCurrency: Currency = { address: token.id as Address, symbol: token.symbol, decimals: TOKEN_DECIMALS };
  const currencyIn = side === "buy" ? quoteCurrency : tokenCurrency;
  const currencyOut = side === "buy" ? tokenCurrency : quoteCurrency;
  const paysWithNativeEth = currencyIn?.address === zeroAddress;

  const config = useReadContract({ address: launchpad, abi: launchpadAbi, functionName: "config" });
  const poolKey =
    config.data && poolKeyFor(token.id as Address, token.quoteToken as Address, config.data[2], token.hooks as Address);
  const isPoolKnown = Boolean(poolKey && poolIdOf(poolKey) === token.poolId);
  const amountIn = currencyIn ? parseAmount(amount, currencyIn.decimals) : 0n;

  const nativeBalance = useBalance({ address: account, query: { enabled: Boolean(account && paysWithNativeEth) } });
  const erc20Balance = useReadContract({
    address: currencyIn?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account!],
    query: { enabled: Boolean(account && currencyIn && !paysWithNativeEth) },
  });
  const balance = paysWithNativeEth ? nativeBalance.data?.value : erc20Balance.data;

  const quote = useQuery({
    queryKey: ["quote", token.id, side, amountIn.toString()],
    enabled: Boolean(isPoolKnown && currencyIn && amountIn > 0n && publicClient),
    queryFn: async () => {
      const { result } = await publicClient!.simulateContract({
        address: V4_QUOTER,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          { poolKey: poolKey!, zeroForOne: isZeroForOne(poolKey!, currencyIn!.address), exactAmount: amountIn, hookData: "0x" },
        ],
      });
      return result[0];
    },
  });

  if (!quoteCurrency || !currencyIn || !currencyOut) return null;

  const confirm = async (hash: Hex) => {
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted");
  };

  const approveCurrencyIn = async () => {
    const allowance = await publicClient!.readContract({
      address: currencyIn.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account!, SWAP_ROUTER],
    });
    if (allowance >= amountIn) return;
    setStep(`Approve ${currencyIn.symbol} in your wallet…`);
    await confirm(
      await writeContractAsync({ address: currencyIn.address, abi: erc20Abi, functionName: "approve", args: [SWAP_ROUTER, amountIn] }),
    );
  };

  const trade = async (event: FormEvent) => {
    event.preventDefault();
    if (!poolKey || !quote.data) return;
    setStatus(undefined);
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      if (!paysWithNativeEth) await approveCurrencyIn();

      setStep("Confirm the swap in your wallet…");
      await confirm(
        await writeContractAsync({
          address: SWAP_ROUTER,
          abi: swapRouterAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            amountIn,
            (quote.data * (100n - SLIPPAGE_PERCENT)) / 100n,
            isZeroForOne(poolKey, currencyIn.address),
            poolKey,
            "0x",
            account!,
            BigInt(secondsFromNow(DEADLINE_SECONDS)),
          ],
          value: paysWithNativeEth ? amountIn : 0n,
        }),
      );
      setStatus({
        tone: "success",
        text: `${side === "buy" ? "Bought" : "Sold"} ${token.symbol}. The trade shows up below in a few seconds.`,
      });
      setAmount("");
      nativeBalance.refetch();
      erc20Balance.refetch();
      router.refresh();
    } catch (cause) {
      setStatus({ tone: "danger", text: errorMessage(cause) });
    } finally {
      setStep(undefined);
    }
  };

  const switchSide = (nextSide: Side) => {
    setSide(nextSide);
    setAmount("");
    setStatus(undefined);
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink p-1 text-sm font-medium">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={Boolean(step)}
            onClick={() => switchSide(option)}
            className={`h-9 rounded-lg capitalize transition ${
              side === option ? (option === "buy" ? "bg-success text-ink" : "bg-danger text-ink") : "text-muted hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {config.data && !isPoolKnown ? (
        <Notice tone="muted">
          This token was launched with pool settings that have since changed, so it cannot be traded here. Trade it on any Uniswap v4
          interface.
        </Notice>
      ) : (
        <form onSubmit={trade} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="flex items-center justify-between text-muted">
              <span>You pay, {currencyIn.symbol}</span>
              {balance !== undefined && (
                <button
                  type="button"
                  className="hover:text-white"
                  disabled={paysWithNativeEth}
                  onClick={() => setAmount(formatUnits(balance, currencyIn.decimals))}
                >
                  Balance: {formatAmount(balance, currencyIn)}
                </button>
              )}
            </span>
            <Input inputMode="decimal" placeholder="0.0" value={amount} disabled={Boolean(step)} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">You receive</span>
            <span className="font-medium">
              {quote.data
                ? `≈ ${formatAmount(quote.data, currencyOut)}`
                : quote.isError
                  ? "No quote for this amount"
                  : quote.isFetching
                    ? "Quoting…"
                    : "—"}
            </span>
          </div>
          {isConnected ? (
            <Button type="submit" disabled={Boolean(step) || !quote.data || (balance !== undefined && amountIn > balance)}>
              {balance !== undefined && amountIn > balance ? `Not enough ${currencyIn.symbol}` : `${side === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
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
