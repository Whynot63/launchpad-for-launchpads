import { type Address, zeroAddress } from "viem";
import { baseSepolia, foundry } from "viem/chains";

export const chain = process.env.NEXT_PUBLIC_CHAIN_ID === "31337" ? foundry : baseSepolia;

export const factoryAddress = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? zeroAddress) as Address;

export const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8080/v1/graphql";

export const launchpadDomain = process.env.NEXT_PUBLIC_LAUNCHPAD_DOMAIN ?? "launch.localhost:3001";

export type QuoteToken = { address: Address; symbol: string; decimals: number };

export const quoteTokens: QuoteToken[] = [
  { address: zeroAddress, symbol: "ETH", decimals: 18 },
  ...(process.env.NEXT_PUBLIC_USDC_ADDRESS
    ? [{ address: process.env.NEXT_PUBLIC_USDC_ADDRESS as Address, symbol: "USDC", decimals: 6 }]
    : []),
];

export const quoteTokenByAddress = (address: string) =>
  quoteTokens.find((quoteToken) => quoteToken.address.toLowerCase() === address.toLowerCase());

export const launchpadUrl = (slug: string) => `${launchpadDomain.startsWith("launch.localhost") ? "http" : "https"}://${slug}.${launchpadDomain}`;
