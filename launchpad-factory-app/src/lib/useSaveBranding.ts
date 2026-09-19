"use client";

import type { Hex } from "viem";
import { useSignMessage } from "wagmi";
import { type LaunchpadMetadata, type StoredLaunchpad, metadataMessage } from "./metadata";

export const useSaveBranding = () => {
  const { signMessageAsync } = useSignMessage();

  return async (metadata: LaunchpadMetadata, creationTxHash?: Hex) => {
    const issuedAt = Date.now();
    const signature = await signMessageAsync({ message: metadataMessage(metadata, issuedAt) });
    const response = await fetch("/api/launchpads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ metadata, issuedAt, signature, creationTxHash }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body as StoredLaunchpad;
  };
};

export const errorMessage = (cause: unknown) =>
  (cause as { shortMessage?: string }).shortMessage ?? (cause instanceof Error ? cause.message : "Something went wrong");
