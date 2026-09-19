import { formatQuoteAmount } from "./format";
import type { IndexedToken } from "./indexer";

const sumByQuoteToken = (tokens: IndexedToken[], field: "volume" | "volume24h" | "liquidity") => {
  const totals = new Map<string, bigint>();
  for (const token of tokens) {
    totals.set(token.quoteToken, (totals.get(token.quoteToken) ?? 0n) + BigInt(token[field]));
  }
  return totals.size === 0
    ? "0"
    : [...totals].map(([quoteToken, total]) => formatQuoteAmount(total, quoteToken)).join(" + ");
};

export const summarizeTokens = (tokens: IndexedToken[]) => ({
  tokenCount: tokens.length,
  trades24h: tokens.reduce((sum, token) => sum + token.numTrades24h, 0),
  volume: sumByQuoteToken(tokens, "volume"),
  volume24h: sumByQuoteToken(tokens, "volume24h"),
  liquidity: sumByQuoteToken(tokens, "liquidity"),
});
