import { indexer } from "envio";
import { getTokenLaunchState } from "../effects/getTokenLaunchState";
import { isTokenCurrency1, quoteUnitsPerWholeToken } from "../price";

indexer.onEvent(
  { contract: "Launchpad", event: "TokenLaunched", fields: { block: ["timestamp"] } },
  async ({ event, context }) => {
    const { token, quoteToken, poolId } = event.params;
    const { totalSupply, sqrtPriceX96 } = await context.effect(getTokenLaunchState, {
      token,
      poolId,
      blockNumber: event.block.number,
    });
    context.Token.set({
      id: token,
      launchpad_id: event.srcAddress,
      creator: event.params.creator,
      poolId,
      quoteToken,
      hooks: event.params.hooks,
      name: event.params.name,
      symbol: event.params.symbol,
      launchedAt: event.block.timestamp,
      totalSupply,
      price: quoteUnitsPerWholeToken(sqrtPriceX96, isTokenCurrency1(token, quoteToken)),
      liquidity: 0n,
      volume: 0n,
      volume24h: 0n,
      numTrades24h: 0,
    });
    context.Pool.set({ id: poolId, token_id: token });

    const launchpad = await context.Launchpad.getOrThrow(event.srcAddress);
    context.Launchpad.set({ ...launchpad, numTokens: launchpad.numTokens + 1 });
  },
);
