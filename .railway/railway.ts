import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

const REPO = "Whynot63/launchpad-for-launchpads";
const LAUNCHPAD_DOMAIN = "launchp.bid";

export default defineRailway(() => {
  const db = postgres("postgres");

  const launchpadFactoryApp = service("launchpad-factory-app", {
    source: github(REPO, { branch: "master", rootDirectory: "launchpad-factory-app" }),
    build: { buildCommand: "pnpm build", watchPatterns: ["/launchpad-factory-app/**"] },
    start: "pnpm start",
    healthcheck: "/create",
    healthcheckTimeout: 120,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      RPC_URL: preserve(),
      NEXT_PUBLIC_CHAIN_ID: "84532",
      NEXT_PUBLIC_FACTORY_ADDRESS: "0xb02F9b23070E7a1Ad3160beC850c485fB7f48939",
      NEXT_PUBLIC_INDEXER_URL: preserve(),
      NEXT_PUBLIC_LAUNCHPAD_DOMAIN: LAUNCHPAD_DOMAIN,
    },
  });

  return project("launchpad-for-launchpads", {
    resources: [launchpadFactoryApp, db],
  });
});
