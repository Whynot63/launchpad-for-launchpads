import { indexer } from "envio";
import { isTokenCurrency1, quoteUnitsPerWholeToken } from "../price";

const HOURS_IN_DAY = 24;
const SECONDS_IN_HOUR = 3600;

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

    const tokenIsCurrency1 = isTokenCurrency1(token.id, token.quoteToken);
    const tokenDelta = tokenIsCurrency1 ? event.params.amount1 : event.params.amount0;
    const quoteDelta = tokenIsCurrency1 ? event.params.amount0 : event.params.amount1;
    const quoteAmount = abs(quoteDelta);
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

    const hour = Math.floor(event.block.timestamp / SECONDS_IN_HOUR);
    const hourDataId = (hourToLoad: number) => `${token.id}_${hourToLoad}`;
    const previousHours = await Promise.all(
      Array.from({ length: HOURS_IN_DAY - 1 }, (_, hoursAgo) => context.TokenHourData.get(hourDataId(hour - hoursAgo - 1))),
    );
    const currentHour = (await context.TokenHourData.get(hourDataId(hour))) ?? {
      id: hourDataId(hour),
      token_id: token.id,
      hour,
      volume: 0n,
      numTrades: 0,
    };
    const updatedCurrentHour = {
      ...currentHour,
      volume: currentHour.volume + quoteAmount,
      numTrades: currentHour.numTrades + 1,
    };
    context.TokenHourData.set(updatedCurrentHour);

    const last24Hours = [updatedCurrentHour, ...previousHours.filter((hourData) => hourData !== undefined)];
    context.Token.set({
      ...token,
      price: quoteUnitsPerWholeToken(event.params.sqrtPriceX96, tokenIsCurrency1),
      liquidity: token.liquidity - quoteDelta,
      volume: token.volume + quoteAmount,
      volume24h: last24Hours.reduce((sum, hourData) => sum + hourData.volume, 0n),
      numTrades24h: last24Hours.reduce((sum, hourData) => sum + hourData.numTrades, 0),
    });
  },
);
