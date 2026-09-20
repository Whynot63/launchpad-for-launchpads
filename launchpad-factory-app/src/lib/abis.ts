import { parseAbi } from "viem";

export const launchpadFactoryAbi = parseAbi([
  "function createLaunchpad(bytes initializeCalldata) returns (address launchpad)",
  "event LaunchpadCreated(address indexed launchpad, address indexed creator)",
]);

export const launchpadAbi = parseAbi([
  "struct Config { uint256 totalSupply; uint256 initialMarketcap; uint24 poolFee; int24 tickSpacing; address hooks; }",
  "function initialize(address owner_, Config config_, address[] quoteTokens)",
  "function setConfig(Config config_)",
  "function setQuoteEnabled(address quoteToken, bool enabled)",
  "function owner() view returns (address)",
  "function config() view returns (uint256 totalSupply, uint256 initialMarketcap, uint24 poolFee, int24 tickSpacing, address hooks)",
  "function isQuoteEnabled(address quoteToken) view returns (bool)",
  "event TokenLaunched(address indexed token, address indexed creator, bytes32 indexed poolId, address quoteToken, address hooks, string name, string symbol)",
]);
