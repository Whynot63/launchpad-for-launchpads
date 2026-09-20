import { indexer } from "envio";

indexer.contractRegister({ contract: "LaunchpadFactory", event: "LaunchpadCreated" }, async ({ event, context }) => {
  context.chain.Launchpad.add(event.params.launchpad);
});

indexer.onEvent(
  { contract: "LaunchpadFactory", event: "LaunchpadCreated", fields: { block: ["timestamp"] } },
  async ({ event, context }) => {
    context.Launchpad.set({
      id: event.params.launchpad,
      creator: event.params.creator,
      createdAt: event.block.timestamp,
      numTokens: 0,
      numTrades: 0,
      numTrades24h: 0,
      volumeUsd: 0n,
      volumeUsd24h: 0n,
    });
  },
);

indexer.onEvent({ contract: "LaunchpadFactory", event: "QuotePriceSet" }, async ({ event, context }) => {
  context.QuotePrice.set({ id: event.params.quoteToken, usdPricePerWad: event.params.usdPricePerWad });
});
