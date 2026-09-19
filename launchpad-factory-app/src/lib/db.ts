import postgres from "postgres";
import type { LaunchpadMetadata, StoredLaunchpad } from "./metadata";

const sql = postgres(process.env.DATABASE_URL!, { transform: postgres.camel });

const schemaReady = sql`
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

export const SLUG_TAKEN = "23505";

export const listLaunchpads = async () => {
  await schemaReady;
  return sql<StoredLaunchpad[]>`SELECT * FROM launchpads ORDER BY created_at DESC`;
};

export const findLaunchpad = async (addressOrSlug: string) => {
  await schemaReady;
  const [launchpad] = await sql<StoredLaunchpad[]>`
    SELECT * FROM launchpads WHERE address = ${addressOrSlug.toLowerCase()} OR slug = ${addressOrSlug.toLowerCase()}
  `;
  return launchpad;
};

export const saveLaunchpad = async (metadata: LaunchpadMetadata, owner: string) => {
  await schemaReady;
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
