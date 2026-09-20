import { indexer } from "envio";
import { isTokenCurrency1, quoteUnitsPerWholeToken } from "../price";
import { recordTradeInRollingDay } from "../rollingDay";

const WAD = 10n ** 18n;

const abs = (value: bigint) => (value < 0n ? -value : value);

indexer.onEvent(
  {
    contract: "PoolManager",
    event: "Swap",
    fields: { block: ["timestamp"], transaction: ["hash"] },
  },
  async ({ event, context }) => {
    const pool = await context.Pool.get(event.params.id);
    if (!pool) return;
    const token = await context.Token.getOrThrow(pool.token_id);
    const launchpad = await context.Launchpad.getOrThrow(token.launchpad_id);
    const quotePrice = await context.QuotePrice.get(token.quoteToken);

    const tokenIsCurrency1 = isTokenCurrency1(token.id, token.quoteToken);
    const tokenDelta = tokenIsCurrency1 ? event.params.amount1 : event.params.amount0;
    const quoteDelta = tokenIsCurrency1 ? event.params.amount0 : event.params.amount1;
    const quoteAmount = abs(quoteDelta);
    const usdAmount = (quoteAmount * (quotePrice?.usdPricePerWad ?? 0n)) / WAD;
    const isBuy = tokenDelta > 0n;

    context.Trade.set({
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      token_id: token.id,
      timestamp: event.block.timestamp,
      tx: event.transaction.hash,
      amountIn: isBuy ? quoteAmount : abs(tokenDelta),
      amountOut: isBuy ? abs(tokenDelta) : quoteAmount,
      direction: isBuy ? "buy" : "sell",
    });

    const tokenLast24Hours = await recordTradeInRollingDay(
      context.TokenHourData,
      token.id,
      event.block.timestamp,
      (id, hour) => ({ id, token_id: token.id, hour, volume: 0n, numTrades: 0 }),
      (hourData) => ({ ...hourData, volume: hourData.volume + quoteAmount, numTrades: hourData.numTrades + 1 }),
    );
    context.Token.set({
      ...token,
      price: quoteUnitsPerWholeToken(event.params.sqrtPriceX96, tokenIsCurrency1),
      liquidity: token.liquidity - quoteDelta,
      volume: token.volume + quoteAmount,
      volume24h: tokenLast24Hours.reduce((sum, hourData) => sum + hourData.volume, 0n),
      numTrades24h: tokenLast24Hours.reduce((sum, hourData) => sum + hourData.numTrades, 0),
    });

    const launchpadLast24Hours = await recordTradeInRollingDay(
      context.LaunchpadHourData,
      launchpad.id,
      event.block.timestamp,
      (id, hour) => ({ id, launchpad_id: launchpad.id, hour, volumeUsd: 0n, numTrades: 0 }),
      (hourData) => ({ ...hourData, volumeUsd: hourData.volumeUsd + usdAmount, numTrades: hourData.numTrades + 1 }),
    );
    context.Launchpad.set({
      ...launchpad,
      numTrades: launchpad.numTrades + 1,
      numTrades24h: launchpadLast24Hours.reduce((sum, hourData) => sum + hourData.numTrades, 0),
      volumeUsd: launchpad.volumeUsd + usdAmount,
      volumeUsd24h: launchpadLast24Hours.reduce((sum, hourData) => sum + hourData.volumeUsd, 0n),
    });
  },
);
