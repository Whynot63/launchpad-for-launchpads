import { formatUnits } from "viem";
import type { QuoteToken } from "./config";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 4 });

export const formatCompact = (value: number) => compact.format(value);

export const formatQuoteAmount = (rawAmount: string | bigint, quoteToken: QuoteToken | undefined) => {
  const amount = Number(formatUnits(BigInt(rawAmount), quoteToken?.decimals ?? 18));
  return `${compact.format(amount)} ${quoteToken?.symbol ?? "?"}`;
};

export const formatTokenPrice = (quoteUnitsPerWholeToken: string, quoteToken: QuoteToken | undefined) => {
  const price = Number(quoteUnitsPerWholeToken) / 10 ** (quoteToken?.decimals ?? 18);
  return `${price.toPrecision(4)} ${quoteToken?.symbol ?? "?"}`;
};

export const formatUsd = (usdWad: string | bigint | undefined) =>
  `$${compact.format(Number(formatUnits(BigInt(usdWad ?? 0), 18)))}`;

export const formatMarketCap = (token: { price: string; totalSupply: string }, quoteToken: QuoteToken | undefined) => {
  const wholeTokens = Number(formatUnits(BigInt(token.totalSupply), 18));
  const marketCap = (Number(token.price) * wholeTokens) / 10 ** (quoteToken?.decimals ?? 18);
  return `${compact.format(marketCap)} ${quoteToken?.symbol ?? "?"}`;
};

export const formatTokenAmount = (rawAmount: string) => compact.format(Number(formatUnits(BigInt(rawAmount), 18)));

export const formatAge = (timestamp: number) => {
  const minutes = Math.max(0, Math.floor((Date.now() / 1000 - timestamp) / 60));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
};

const precise = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3, maximumFractionDigits: 20 });

export const formatUsdPrecise = (usd: number) => `$${precise.format(usd)}`;

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
