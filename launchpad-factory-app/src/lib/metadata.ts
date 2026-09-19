export type LaunchpadMetadata = {
  address: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  accentColor: string;
};

export type StoredLaunchpad = LaunchpadMetadata & { owner: string; createdAt: string };

const RESERVED_SLUGS = ["www", "app", "api", "admin", "launch", "xxx"];
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const SIGNATURE_LIFETIME_MS = 10 * 60 * 1000;

export const slugFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export const metadataError = (metadata: LaunchpadMetadata) => {
  if (!ADDRESS_PATTERN.test(metadata.address)) return "Invalid launchpad address";
  if (!SLUG_PATTERN.test(metadata.slug)) return "Subdomain must be 3–32 characters: lowercase letters, digits, and hyphens";
  if (RESERVED_SLUGS.includes(metadata.slug)) return "This subdomain is reserved";
  if (metadata.name.trim().length < 2 || metadata.name.length > 50) return "Name must be 2–50 characters";
  if (metadata.description.length > 280) return "Description must be at most 280 characters";
  if (metadata.logoUrl && !/^https:\/\/\S{1,500}$/.test(metadata.logoUrl)) return "Logo must be an https URL";
  if (!COLOR_PATTERN.test(metadata.accentColor)) return "Accent color must be a hex color";
  return null;
};

export const isSignatureFresh = (issuedAt: number) => Math.abs(Date.now() - issuedAt) < SIGNATURE_LIFETIME_MS;

export const metadataMessage = (metadata: LaunchpadMetadata, issuedAt: number) =>
  [
    "Set XXX launchpad branding",
    `Launchpad: ${metadata.address.toLowerCase()}`,
    `Subdomain: ${metadata.slug}`,
    `Name: ${metadata.name}`,
    `Description: ${metadata.description}`,
    `Logo: ${metadata.logoUrl}`,
    `Accent color: ${metadata.accentColor}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
