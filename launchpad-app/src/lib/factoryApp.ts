import "server-only";
import { type Hook, type QuoteToken, factoryAppUrl } from "./config";
import type { StoredToken } from "./tokenMetadata";

export const FACTORY_APP_INTERNAL_URL = process.env.FACTORY_APP_INTERNAL_URL ?? factoryAppUrl;

const getJson = async <Data>(path: string) => {
  const response = await fetch(`${FACTORY_APP_INTERNAL_URL}${path}`, { cache: "no-store" }).catch(() => undefined);
  return response?.ok ? ((await response.json()) as Data) : undefined;
};

export const fetchTokenDetails = (token: string) => getJson<StoredToken>(`/api/tokens/${token}`);

export const fetchLaunchpadTokenDetails = async (launchpad: string) =>
  new Map(((await getJson<StoredToken[]>(`/api/tokens?launchpad=${launchpad}`)) ?? []).map((token) => [token.address, token]));

const fetchWhitelist = async () => {
  const response = await fetch(`${FACTORY_APP_INTERNAL_URL}/api/whitelist`, { next: { revalidate: 60 } }).catch(() => undefined);
  return response?.ok ? ((await response.json()) as { hooks: Hook[]; quotes: QuoteToken[] }) : { hooks: [], quotes: [] };
};

export const fetchQuoteTokens = async () => (await fetchWhitelist()).quotes;

export const isFeeHook = async (hook: string) =>
  (await fetchWhitelist()).hooks.some(
    (whitelisted) => whitelisted.hasFeeSetup && whitelisted.address.toLowerCase() === hook.toLowerCase(),
  );
