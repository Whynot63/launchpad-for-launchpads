import { createPublicClient, http } from "viem";
import { chain } from "./config";

export const publicClient = createPublicClient({ chain, transport: http(process.env.RPC_URL) });
