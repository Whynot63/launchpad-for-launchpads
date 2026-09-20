import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Address } from "viem";
import { FACTORY_APP_INTERNAL_URL } from "./factoryApp";

export type Launchpad = {
  address: Address;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  accentColor: string;
  owner: Address;
};

export const launchpadSlugFromHost = (host: string) => host.split(":")[0].split(".")[0];

export const findCurrentLaunchpad = cache(async () => {
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host") ?? "";
  const response = await fetch(`${FACTORY_APP_INTERNAL_URL}/api/launchpads/${launchpadSlugFromHost(host)}`, {
    next: { revalidate: 30 },
  });
  return response.ok ? ((await response.json()) as Launchpad) : undefined;
});

export const getCurrentLaunchpad = async () => (await findCurrentLaunchpad()) ?? notFound();
