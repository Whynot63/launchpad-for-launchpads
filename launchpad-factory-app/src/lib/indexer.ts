import { indexerUrl } from "./config";

export type IndexedToken = {
  id: string;
  name: string;
  symbol: string;
  quoteToken: string;
  launchedAt: number;
  price: string;
  liquidity: string;
  volume: string;
  volume24h: string;
  numTrades24h: number;
};

export type IndexedLaunchpad = { id: string; creator: string; createdAt: number; tokens: IndexedToken[] };

const TOKEN_FIELDS = "id name symbol quoteToken launchedAt price liquidity volume volume24h numTrades24h";

const query = async <Data>(document: string, variables: Record<string, unknown> = {}) => {
  const response = await fetch(indexerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    cache: "no-store",
  });
  const { data, errors } = await response.json();
  if (errors) throw new Error(errors[0].message);
  return data as Data;
};

export const fetchIndexedLaunchpads = async () =>
  (await query<{ Launchpad: IndexedLaunchpad[] }>(`{ Launchpad { id creator createdAt tokens { ${TOKEN_FIELDS} } } }`))
    .Launchpad;

export const fetchIndexedLaunchpad = async (address: string) =>
  (
    await query<{ Launchpad: IndexedLaunchpad[] }>(
      `query ($address: String!) {
        Launchpad(where: { id: { _ilike: $address } }) {
          id creator createdAt tokens(order_by: { launchedAt: desc }) { ${TOKEN_FIELDS} }
        }
      }`,
      { address },
    )
  ).Launchpad[0];
