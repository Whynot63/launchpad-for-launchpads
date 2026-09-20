import { type Address, type Hex, createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { deviationBps, shouldUpdatePrice } from "./deviation.ts";

const BINANCE_TICKER_URL = "https://www.binance.com/api/v3/ticker/price?symbol=ETHUSDT";
const QUOTE_TOKEN = zeroAddress;
const ONE_WHOLE_ETH = 10n ** 18n;
const USD_DECIMALS = 18;

const factoryAbi = parseAbi([
  "function quotePrice(address quoteToken, uint256 amount) view returns (uint256)",
  "function setQuotePrice(address quoteToken, uint256 usdPricePerWad)",
  "error QuotePriceNotSet()",
]);

const factory = process.env.FACTORY_ADDRESS as Address;
const transport = http(process.env.RPC_URL ?? "https://sepolia.base.org");
const publicClient = createPublicClient({ chain: baseSepolia, transport });

const fetchMarketPrice = async () => {
  const response = await fetch(BINANCE_TICKER_URL);
  if (!response.ok) throw new Error(`Binance responded with status ${response.status}`);
  const { price }: { price: string } = await response.json();
  return parseUnits(price, USD_DECIMALS);
};

const readContractPrice = () =>
  publicClient
    .readContract({ address: factory, abi: factoryAbi, functionName: "quotePrice", args: [QUOTE_TOKEN, ONE_WHOLE_ETH] })
    .catch((cause: { message: string }) => {
      if (cause.message.includes("QuotePriceNotSet")) return undefined;
      throw cause;
    });

const formatUsd = (price: bigint | undefined) => (price === undefined ? "not set" : `$${formatUnits(price, USD_DECIMALS)}`);

const [marketPrice, contractPrice] = await Promise.all([fetchMarketPrice(), readContractPrice()]);
console.log(`market ${formatUsd(marketPrice)}, contract ${formatUsd(contractPrice)}`);

if (!shouldUpdatePrice(contractPrice, marketPrice)) {
  console.log(`deviation ${deviationBps(contractPrice!, marketPrice)} bps is within the threshold, nothing to do`);
  process.exit(0);
}

if (!process.env.PRICE_UPDATER_PRIVATE_KEY) {
  console.log("price needs an update, but PRICE_UPDATER_PRIVATE_KEY is not set: dry run, no transaction sent");
  process.exit(0);
}

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRICE_UPDATER_PRIVATE_KEY as Hex),
  chain: baseSepolia,
  transport,
});
const hash = await walletClient.writeContract({
  address: factory,
  abi: factoryAbi,
  functionName: "setQuotePrice",
  args: [QUOTE_TOKEN, marketPrice],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`price set to ${formatUsd(marketPrice)} in ${hash} (${receipt.status})`);
if (receipt.status !== "success") process.exit(1);
