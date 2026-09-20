import { formatUnits } from "viem";
import { quoteTokenByAddress } from "./config";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 4 });

export const formatCompact = (value: number) => compact.format(value);

export const formatQuoteAmount = (rawAmount: string | bigint, quoteTokenAddress: string) => {
  const quoteToken = quoteTokenByAddress(quoteTokenAddress);
  const amount = Number(formatUnits(BigInt(rawAmount), quoteToken?.decimals ?? 18));
  return `${compact.format(amount)} ${quoteToken?.symbol ?? "?"}`;
};

export const formatTokenPrice = (quoteUnitsPerWholeToken: string, quoteTokenAddress: string) => {
  const quoteToken = quoteTokenByAddress(quoteTokenAddress);
  const price = Number(quoteUnitsPerWholeToken) / 10 ** (quoteToken?.decimals ?? 18);
  return `${price.toPrecision(4)} ${quoteToken?.symbol ?? "?"}`;
};

export const formatUsd = (usdWad: string | bigint | undefined) =>
  `$${compact.format(Number(formatUnits(BigInt(usdWad ?? 0), 18)))}`;

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
