import { type Address, encodeAbiParameters, keccak256, parseAbi } from "viem";

export const SWAP_ROUTER: Address = "0x00000000000044a361Ae3cAc094c9D1b14Eece97";
export const V4_QUOTER: Address = "0x4A6513c898fe1B2d0E78d3b0e0A4a151589B1cBa";

export type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };

const POOL_KEY_COMPONENTS = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

export const swapRouterAbi = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "zeroForOne", type: "bool" },
      { name: "poolKey", type: "tuple", components: POOL_KEY_COMPONENTS },
      { name: "hookData", type: "bytes" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
] as const;

export const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: POOL_KEY_COMPONENTS },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

export const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const poolKeyFor = (token: Address, quoteToken: Address, fee: number, tickSpacing: number, hooks: Address): PoolKey => {
  const quoteIsCurrency0 = BigInt(quoteToken) < BigInt(token);
  return {
    currency0: quoteIsCurrency0 ? quoteToken : token,
    currency1: quoteIsCurrency0 ? token : quoteToken,
    fee,
    tickSpacing,
    hooks,
  };
};

export const poolIdOf = (poolKey: PoolKey) =>
  keccak256(encodeAbiParameters([{ type: "tuple", components: POOL_KEY_COMPONENTS }], [poolKey]));

export const isZeroForOne = (poolKey: PoolKey, currencyIn: Address) =>
  poolKey.currency0.toLowerCase() === currencyIn.toLowerCase();
