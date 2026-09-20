"use client";

import type { Address } from "viem";
import { useReadContracts } from "wagmi";
import { launchpadAbi } from "@/lib/abis";
import { hooks, quoteTokens } from "@/lib/config";
import { ClaimFees } from "./ClaimFees";

export function LaunchpadFees({ launchpad }: { launchpad: Address }) {
  const onchain = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: launchpad, abi: launchpadAbi, functionName: "owner" },
      { address: launchpad, abi: launchpadAbi, functionName: "config" },
    ],
  });
  if (!onchain.data) return null;

  const [owner, [, , , hook]] = onchain.data;
  const collectsFees = hooks.some((whitelisted) => whitelisted.hasFeeSetup && whitelisted.address.toLowerCase() === hook.toLowerCase());
  if (!collectsFees) return null;

  return <ClaimFees title="Your Launchpad Fees" hook={hook} feeAccount={launchpad} claimer={owner} quoteTokens={quoteTokens} />;
}
