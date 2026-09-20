import { type Address, type Hex, isAddressEqual, parseEventLogs } from "viem";
import { launchpadAbi, launchpadFactoryAbi } from "@/lib/abis";
import { publicClient } from "@/lib/chainClient";
import { factoryAddress } from "@/lib/config";
import { SLUG_TAKEN, findLaunchpad, listLaunchpads, saveLaunchpad } from "@/lib/db";
import { type LaunchpadMetadata, isSignatureFresh, metadataError, metadataMessage } from "@/lib/metadata";

type SaveRequest = { metadata: LaunchpadMetadata; issuedAt: number; signature: Hex; creationTxHash?: Hex };

const error = (message: string, status: number) => Response.json({ error: message }, { status });

const wasCreatedByFactory = async (launchpad: Address, creationTxHash: Hex) => {
  const receipt = await publicClient.getTransactionReceipt({ hash: creationTxHash });
  return parseEventLogs({ abi: launchpadFactoryAbi, eventName: "LaunchpadCreated", logs: receipt.logs }).some(
    (log) => isAddressEqual(log.address, factoryAddress) && isAddressEqual(log.args.launchpad, launchpad),
  );
};

export async function GET() {
  return Response.json(await listLaunchpads());
}

export async function POST(request: Request) {
  const { metadata, issuedAt, signature, creationTxHash }: SaveRequest = await request.json();

  const invalid = metadataError(metadata);
  if (invalid) return error(invalid, 400);
  if (!isSignatureFresh(issuedAt)) return error("Signature expired, sign again", 400);

  const launchpad = metadata.address as Address;
  const isKnown = Boolean(await findLaunchpad(launchpad));
  if (!isKnown && !(creationTxHash && (await wasCreatedByFactory(launchpad, creationTxHash)))) {
    return error("This launchpad was not created by the launchpad factory", 400);
  }

  const owner = await publicClient.readContract({ address: launchpad, abi: launchpadAbi, functionName: "owner" });
  const isSignedByOwner = await publicClient.verifyMessage({
    address: owner,
    message: metadataMessage(metadata, issuedAt),
    signature,
  });
  if (!isSignedByOwner) return error("Only the launchpad owner can set its branding", 403);

  try {
    return Response.json(await saveLaunchpad(metadata, owner));
  } catch (cause) {
    if ((cause as { code?: string }).code === SLUG_TAKEN) return error("This subdomain is already taken", 409);
    throw cause;
  }
}
