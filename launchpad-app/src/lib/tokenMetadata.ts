import { LOGO_PATH_PATTERN } from "./uploads";

export type TokenLinks = { website: string; twitter: string; telegram: string };

export type TokenMetadata = TokenLinks & { address: string; description: string; imageUrl: string };

export type StoredToken = TokenMetadata & { launchpad: string; creator: string };

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const LINK_PATTERN = /^https:\/\/\S{1,200}$/;
const LINK_FIELDS = ["website", "twitter", "telegram"] as const;

export const tokenMetadataError = (metadata: TokenMetadata) => {
  if (!ADDRESS_PATTERN.test(metadata.address)) return "Invalid token address";
  if (metadata.description.length > 500) return "Description must be at most 500 characters";
  if (metadata.imageUrl && !LOGO_PATH_PATTERN.test(metadata.imageUrl)) return "Logo must be an uploaded image";
  if (LINK_FIELDS.some((field) => metadata[field] && !LINK_PATTERN.test(metadata[field]))) return "Links must be https URLs";
  return null;
};

export const tokenMetadataMessage = (metadata: TokenMetadata, issuedAt: number) =>
  [
    "Set token details",
    `Token: ${metadata.address.toLowerCase()}`,
    `Description: ${metadata.description}`,
    `Logo: ${metadata.imageUrl}`,
    `Website: ${metadata.website}`,
    `X: ${metadata.twitter}`,
    `Telegram: ${metadata.telegram}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
