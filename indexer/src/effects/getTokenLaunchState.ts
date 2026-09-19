import { S, createEffect, indexer } from "envio";
import { createPublicClient, encodeAbiParameters, http, keccak256, parseAbi } from "viem";

const POOLS_SLOT = 6n;
const SQRT_PRICE_X96_MASK = 2n ** 160n - 1n;

const client = createPublicClient({ transport: http(process.env.ENVIO_RPC_URL, { batch: true }) });

const abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function extsload(bytes32 slot) view returns (bytes32)",
]);

export const getTokenLaunchState = createEffect(
  {
    name: "getTokenLaunchState",
    input: { token: S.string, poolId: S.string, blockNumber: S.number },
    output: { totalSupply: S.bigint, sqrtPriceX96: S.bigint },
    cache: true,
    rateLimit: false,
    crossChain: false,
  },
  async ({ input, context }) => {
    const poolManager = indexer.chains[context.chain.id as keyof typeof indexer.chains].PoolManager.addresses[0]!;
    const blockNumber = BigInt(input.blockNumber);
    const slot0Slot = keccak256(
      encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [input.poolId as `0x${string}`, POOLS_SLOT]),
    );
    const [totalSupply, slot0] = await Promise.all([
      client.readContract({ address: input.token as `0x${string}`, abi, functionName: "totalSupply", blockNumber }),
      client.readContract({ address: poolManager, abi, functionName: "extsload", args: [slot0Slot], blockNumber }),
    ]);
    return { totalSupply, sqrtPriceX96: BigInt(slot0) & SQRT_PRICE_X96_MASK };
  },
);
