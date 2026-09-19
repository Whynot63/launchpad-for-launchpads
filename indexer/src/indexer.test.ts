import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, it } from "vitest";
import { createTestIndexer } from "envio";

const CHAIN_ID = 84532;
const LAUNCHPAD = "0x1111111111111111111111111111111111111111" as const;
const LAUNCHPAD_CREATOR = "0x2222222222222222222222222222222222222222" as const;
const TOKEN = "0xb200000000000000000000000000000000000001" as const;
const TOKEN_CREATOR = "0x3333333333333333333333333333333333333333" as const;
const POOL_ID = "0x5555555555555555555555555555555555555555555555555555555555555555";
const OTHER_POOL_ID = "0x6666666666666666666666666666666666666666666666666666666666666666";
const ETH = "0x0000000000000000000000000000000000000000" as const;
const HOOKS = "0x4444000000000000000000000000000000002000" as const;
const TOTAL_SUPPLY = 10n ** 27n;
const Q96 = 2n ** 96n;
const HOUR = 3600;
const LAUNCHED_AT = 100 * HOUR;

const STARTING_SQRT_PRICE_X96 = 1000n * Q96;
const SLOT0_WITH_TICK_AND_FEES_ABOVE_PRICE = (123n << 160n) | STARTING_SQRT_PRICE_X96;

const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
const toWord = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

const rpc = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const parsed = JSON.parse(body);
    const answer = (call: { id: number; params: [{ data: string }] }) => ({
      jsonrpc: "2.0",
      id: call.id,
      result: call.params[0].data.startsWith(TOTAL_SUPPLY_SELECTOR)
        ? toWord(TOTAL_SUPPLY)
        : toWord(SLOT0_WITH_TICK_AND_FEES_ABOVE_PRICE),
    });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(Array.isArray(parsed) ? parsed.map(answer) : answer(parsed)));
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve) => rpc.listen(0, resolve));
  process.env.ENVIO_RPC_URL = `http://127.0.0.1:${(rpc.address() as AddressInfo).port}`;
});

afterAll(() => rpc.close());

const launchpadCreated = {
  contract: "LaunchpadFactory" as const,
  event: "LaunchpadCreated" as const,
  block: { number: 1, timestamp: 1000 },
  params: { launchpad: LAUNCHPAD, creator: LAUNCHPAD_CREATOR },
};

const tokenLaunched = {
  contract: "Launchpad" as const,
  event: "TokenLaunched" as const,
  srcAddress: LAUNCHPAD,
  block: { number: 2, timestamp: LAUNCHED_AT },
  params: {
    token: TOKEN,
    creator: TOKEN_CREATOR,
    poolId: POOL_ID,
    quoteToken: ETH,
    hooks: HOOKS,
    name: "Test Token",
    symbol: "TEST",
  },
};

const swap = (
  blockNumber: number,
  timestamp: number,
  hash: string,
  params: { id?: string; amount0: bigint; amount1: bigint; sqrtPriceX96: bigint },
) => ({
  contract: "PoolManager" as const,
  event: "Swap" as const,
  block: { number: blockNumber, timestamp },
  transaction: { hash },
  params: { id: POOL_ID, ...params },
});

describe("creation events", () => {
  it("indexes a launchpad and a token launched through it", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({ chains: { [CHAIN_ID]: { simulate: [launchpadCreated, tokenLaunched] } } });

    t.expect(indexer.chains[CHAIN_ID].Launchpad.addresses).toContain(LAUNCHPAD);
    t.expect(await indexer.Launchpad.getOrThrow(LAUNCHPAD)).toEqual({
      id: LAUNCHPAD,
      creator: LAUNCHPAD_CREATOR,
      createdAt: 1000,
      chainId: CHAIN_ID,
    });
    const token = await indexer.Token.getOrThrow(TOKEN);
    t.expect({ ...token, price: token.price.toString() }).toEqual({
      id: TOKEN,
      launchpad_id: LAUNCHPAD,
      creator: TOKEN_CREATOR,
      poolId: POOL_ID,
      quoteToken: ETH,
      hooks: HOOKS,
      name: "Test Token",
      symbol: "TEST",
      launchedAt: LAUNCHED_AT,
      totalSupply: TOTAL_SUPPLY,
      price: "1000000000000",
      liquidity: 0n,
      volume: 0n,
      volume24h: 0n,
      numTrades24h: 0,
      chainId: CHAIN_ID,
    });
  });
});

describe("trades", () => {
  it("records buys and sells and updates token stats", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            launchpadCreated,
            tokenLaunched,
            swap(3, LAUNCHED_AT + 60, "0xaa", { amount0: -(10n ** 18n), amount1: 9n * 10n ** 23n, sqrtPriceX96: 500n * Q96 }),
            swap(4, LAUNCHED_AT + HOUR, "0xbb", { amount0: 4n * 10n ** 17n, amount1: -(5n * 10n ** 23n), sqrtPriceX96: 800n * Q96 }),
          ],
        },
      },
    });

    const trades = (await indexer.Trade.getAll()).sort((a, b) => a.timestamp - b.timestamp);
    t.expect(trades.map(({ id, chainId, ...trade }) => trade)).toEqual([
      {
        token_id: TOKEN,
        timestamp: LAUNCHED_AT + 60,
        tx: "0xaa",
        amountIn: 10n ** 18n,
        amountOut: 9n * 10n ** 23n,
        direction: "buy",
      },
      {
        token_id: TOKEN,
        timestamp: LAUNCHED_AT + HOUR,
        tx: "0xbb",
        amountIn: 5n * 10n ** 23n,
        amountOut: 4n * 10n ** 17n,
        direction: "sell",
      },
    ]);
    const token = await indexer.Token.getOrThrow(TOKEN);
    t.expect(token.price.toString()).toBe("1562500000000");
    t.expect(token.liquidity).toBe(6n * 10n ** 17n);
    t.expect(token.volume).toBe(14n * 10n ** 17n);
    t.expect(token.volume24h).toBe(14n * 10n ** 17n);
    t.expect(token.numTrades24h).toBe(2);
  });

  it("drops trades older than 24 hours from the 24h stats", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            launchpadCreated,
            tokenLaunched,
            swap(3, LAUNCHED_AT + 60, "0xaa", { amount0: -(10n ** 18n), amount1: 9n * 10n ** 23n, sqrtPriceX96: 500n * Q96 }),
            swap(4, LAUNCHED_AT + 25 * HOUR, "0xbb", { amount0: -(2n * 10n ** 18n), amount1: 10n ** 23n, sqrtPriceX96: 400n * Q96 }),
          ],
        },
      },
    });

    const token = await indexer.Token.getOrThrow(TOKEN);
    t.expect(token.volume).toBe(3n * 10n ** 18n);
    t.expect(token.volume24h).toBe(2n * 10n ** 18n);
    t.expect(token.numTrades24h).toBe(1);
  });

  it("ignores swaps in pools that were not created by a launchpad", async (t) => {
    const indexer = createTestIndexer();

    await indexer.process({
      chains: {
        [CHAIN_ID]: {
          simulate: [
            launchpadCreated,
            tokenLaunched,
            swap(3, LAUNCHED_AT + 60, "0xaa", { id: OTHER_POOL_ID, amount0: -1n, amount1: 1n, sqrtPriceX96: Q96 }),
          ],
        },
      },
    });

    t.expect(await indexer.Trade.getAll()).toEqual([]);
  });
});
