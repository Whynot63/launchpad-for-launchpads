import postgres from "postgres";
import type { LaunchpadMetadata, StoredLaunchpad } from "./metadata";
import type { StoredToken } from "./tokenMetadata";

const sql = postgres(process.env.DATABASE_URL!, { transform: postgres.camel });

const createLaunchpadsTable = () => sql`
  CREATE TABLE IF NOT EXISTS launchpads (
    address TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    owner TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const createTokensTable = () => sql`
  CREATE TABLE IF NOT EXISTS tokens (
    address TEXT PRIMARY KEY,
    launchpad TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    website TEXT NOT NULL,
    twitter TEXT NOT NULL,
    telegram TEXT NOT NULL,
    creator TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

let schema: Promise<unknown> | undefined;

const schemaReady = () => (schema ??= Promise.all([createLaunchpadsTable(), createTokensTable()]));

export const SLUG_TAKEN = "23505";

export const listLaunchpads = async () => {
  await schemaReady();
  return sql<StoredLaunchpad[]>`SELECT * FROM launchpads ORDER BY created_at DESC`;
};

export const findLaunchpad = async (addressOrSlug: string) => {
  await schemaReady();
  const [launchpad] = await sql<StoredLaunchpad[]>`
    SELECT * FROM launchpads WHERE address = ${addressOrSlug.toLowerCase()} OR slug = ${addressOrSlug.toLowerCase()}
  `;
  return launchpad;
};

export const saveLaunchpad = async (metadata: LaunchpadMetadata, owner: string) => {
  await schemaReady();
  const row = {
    address: metadata.address.toLowerCase(),
    slug: metadata.slug,
    name: metadata.name.trim(),
    description: metadata.description.trim(),
    logoUrl: metadata.logoUrl,
    accentColor: metadata.accentColor,
    owner: owner.toLowerCase(),
  };
  const [saved] = await sql`
    INSERT INTO launchpads ${sql(row)}
    ON CONFLICT (address) DO UPDATE SET ${sql(row, "slug", "name", "description", "logoUrl", "accentColor", "owner")}
    RETURNING *
  `;
  return saved as StoredLaunchpad;
};

export const listLaunchpadTokens = async (launchpad: string) => {
  await schemaReady();
  return sql<StoredToken[]>`SELECT * FROM tokens WHERE launchpad = ${launchpad.toLowerCase()}`;
};

export const findToken = async (address: string) => {
  await schemaReady();
  const [token] = await sql<StoredToken[]>`SELECT * FROM tokens WHERE address = ${address.toLowerCase()}`;
  return token;
};

export const saveTokenOnce = async (token: StoredToken) => {
  await schemaReady();
  const row = {
    address: token.address.toLowerCase(),
    launchpad: token.launchpad.toLowerCase(),
    description: token.description.trim(),
    imageUrl: token.imageUrl,
    website: token.website,
    twitter: token.twitter,
    telegram: token.telegram,
    creator: token.creator.toLowerCase(),
  };
  const [saved] = await sql`INSERT INTO tokens ${sql(row)} ON CONFLICT (address) DO NOTHING RETURNING *`;
  return saved as StoredToken | undefined;
};
