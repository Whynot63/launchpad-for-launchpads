import { parseAbi } from "viem";

export const launchpadAbi = parseAbi([
  "function launchToken(string name, string symbol, address quoteToken) returns (address token)",
  "function isQuoteEnabled(address quoteToken) view returns (bool)",
  "event TokenLaunched(address indexed token, address indexed creator, bytes32 indexed poolId, address quoteToken, address hooks, string name, string symbol)",
]);
