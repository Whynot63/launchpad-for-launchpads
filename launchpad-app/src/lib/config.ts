import type { Address } from "viem";
import { baseSepolia, foundry } from "viem/chains";
import whitelist from "./whitelist.json";

export const chain = process.env.NEXT_PUBLIC_CHAIN_ID === "31337" ? foundry : baseSepolia;

export const factoryAppUrl = process.env.NEXT_PUBLIC_FACTORY_APP_URL ?? "http://localhost:3000";

export type QuoteToken = { address: Address; symbol: string; decimals: number };

export const quoteTokens = whitelist.quotes as QuoteToken[];

export const quoteTokenByAddress = (address: string) =>
  quoteTokens.find((quoteToken) => quoteToken.address.toLowerCase() === address.toLowerCase());

export const explorerTxUrl = (hash: string) => `${chain.blockExplorers?.default.url}/tx/${hash}`;
