import "server-only";

const INDEXER_URL = process.env.INDEXER_URL ?? "http://localhost:8080/v1/graphql";

export type IndexedToken = {
  id: string;
  creator: string;
  poolId: string;
  hooks: string;
  name: string;
  symbol: string;
  quoteToken: string;
  launchedAt: number;
  totalSupply: string;
  price: string;
  liquidity: string;
  volume: string;
  volume24h: string;
  numTrades24h: number;
};

export type IndexedTrade = {
  id: string;
  timestamp: number;
  tx: string;
  amountIn: string;
  amountOut: string;
  direction: "buy" | "sell";
};

const TOKEN_FIELDS =
  "id creator poolId hooks name symbol quoteToken launchedAt totalSupply price liquidity volume volume24h numTrades24h";

const query = async <Data>(document: string, variables: Record<string, unknown>) => {
  const response = await fetch(INDEXER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    cache: "no-store",
  });
  const { data, errors } = await response.json();
  if (errors) throw new Error(errors[0].message);
  return data as Data;
};

export const fetchLaunchpadTokens = async (launchpad: string) =>
  (
    await query<{ Token: IndexedToken[] }>(
      `query ($launchpad: String!) {
        Token(where: { launchpad_id: { _ilike: $launchpad } }, order_by: { launchedAt: desc }) { ${TOKEN_FIELDS} }
      }`,
      { launchpad },
    )
  ).Token;

export const fetchToken = async (launchpad: string, token: string) =>
  (
    await query<{ Token: (IndexedToken & { trades: IndexedTrade[] })[] }>(
      `query ($launchpad: String!, $token: String!) {
        Token(where: { id: { _ilike: $token }, launchpad_id: { _ilike: $launchpad } }) {
          ${TOKEN_FIELDS}
          trades(order_by: { timestamp: desc }, limit: 50) { id timestamp tx amountIn amountOut direction }
        }
      }`,
      { launchpad, token },
    )
  ).Token[0];
