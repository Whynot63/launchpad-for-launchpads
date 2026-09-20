import { type Hex, isAddressEqual, parseEventLogs } from "viem";
import { launchpadAbi } from "@/lib/abis";
import { publicClient } from "@/lib/chainClient";
import { findLaunchpad, listLaunchpadTokens, saveTokenOnce } from "@/lib/db";
import { isSignatureFresh } from "@/lib/metadata";
import { type TokenMetadata, tokenMetadataError, tokenMetadataMessage } from "@/lib/tokenMetadata";

type SaveRequest = { metadata: TokenMetadata; issuedAt: number; signature: Hex; launchTxHash: Hex };

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET(request: Request) {
  const launchpad = new URL(request.url).searchParams.get("launchpad");
  return launchpad ? Response.json(await listLaunchpadTokens(launchpad)) : error("Pass a launchpad address", 400);
}

export async function POST(request: Request) {
  const { metadata, issuedAt, signature, launchTxHash }: SaveRequest = await request.json();

  const invalid = tokenMetadataError(metadata);
  if (invalid) return error(invalid, 400);
  if (!isSignatureFresh(issuedAt)) return error("Signature expired, sign again", 400);

  const receipt = await publicClient.getTransactionReceipt({ hash: launchTxHash });
  const launch = parseEventLogs({ abi: launchpadAbi, eventName: "TokenLaunched", logs: receipt.logs }).find((log) =>
    isAddressEqual(log.args.token, metadata.address as Hex),
  );
  if (!launch || !(await findLaunchpad(launch.address))) {
    return error("This token was not launched through a known launchpad", 400);
  }

  const isSignedByCreator = await publicClient.verifyMessage({
    address: launch.args.creator,
    message: tokenMetadataMessage(metadata, issuedAt),
    signature,
  });
  if (!isSignedByCreator) return error("Only the token creator can set its details", 403);

  const saved = await saveTokenOnce({ ...metadata, launchpad: launch.address, creator: launch.args.creator });
  return saved ? Response.json(saved) : error("Details for this token are already set", 409);
}
