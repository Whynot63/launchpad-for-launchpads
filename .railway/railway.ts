import { defineRailway, github, postgres, preserve, project, service } from "railway/iac";

const REPO = "Whynot63/launchpad-for-launchpads";

export default defineRailway(() => {
  const db = postgres("postgres");

  const launchpadFactoryApp = service("launchpad-factory-app", {
    source: github(REPO, { branch: "master", rootDirectory: "launchpad-factory-app" }),
    build: "pnpm build",
    start: "pnpm start",
    healthcheck: "/create",
    healthcheckTimeout: 120,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      RPC_URL: preserve(),
      NEXT_PUBLIC_CHAIN_ID: "84532",
      NEXT_PUBLIC_FACTORY_ADDRESS: preserve(),
      NEXT_PUBLIC_INDEXER_URL: preserve(),
      NEXT_PUBLIC_LAUNCHPAD_DOMAIN: preserve(),
    },
  });

  return project("launchpad-for-launchpads", {
    resources: [launchpadFactoryApp, db],
  });
});
