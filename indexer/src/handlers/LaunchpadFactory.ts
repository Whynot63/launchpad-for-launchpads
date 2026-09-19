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
    });
  },
);
