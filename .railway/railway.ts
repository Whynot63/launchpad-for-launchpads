import { bucket, defineRailway, github, postgres, preserve, project, ref, service } from "railway/iac";

const REPO = "Whynot63/launchpad-for-launchpads";
const LAUNCHPAD_DOMAIN = "launchp.bid";

export default defineRailway((ctx) => {
  const db = postgres("postgres");
  const staticBucket = bucket("launchpad-static", { region: "sjc" });

  const launchpadFactoryApp = service("launchpad-factory-app", {
    source: github(REPO, { branch: "master", rootDirectory: "launchpad-factory-app" }),
    build: { buildCommand: "pnpm build", watchPatterns: ["/launchpad-factory-app/**"] },
    start: "pnpm start",
    healthcheck: "/create",
    healthcheckTimeout: 120,
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      S3_BUCKET: ref(staticBucket, "BUCKET"),
      S3_ENDPOINT: ref(staticBucket, "ENDPOINT"),
      S3_REGION: ref(staticBucket, "REGION"),
      S3_ACCESS_KEY_ID: ref(staticBucket, "ACCESS_KEY_ID"),
      S3_SECRET_ACCESS_KEY: ref(staticBucket, "SECRET_ACCESS_KEY"),
      RPC_URL: preserve(),
      NEXT_PUBLIC_CHAIN_ID: "84532",
      NEXT_PUBLIC_FACTORY_ADDRESS: "0xb02F9b23070E7a1Ad3160beC850c485fB7f48939",
      INDEXER_URL: ctx.shared.INDEXER_URL,
      NEXT_PUBLIC_REOWN_PROJECT_ID: "f47bcbec5e1305efd898d8ca6df425c1",
      NEXT_PUBLIC_LAUNCHPAD_DOMAIN: LAUNCHPAD_DOMAIN,
    },
  });

  const launchpadApp = service("launchpad-app", {
    source: github(REPO, { branch: "master", rootDirectory: "launchpad-app" }),
    build: { buildCommand: "pnpm build", watchPatterns: ["/launchpad-app/**"] },
    start: "pnpm start",
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    env: {
      NEXT_PUBLIC_CHAIN_ID: "84532",
      NEXT_PUBLIC_FACTORY_APP_URL: `https://${LAUNCHPAD_DOMAIN}`,
      NEXT_PUBLIC_REOWN_PROJECT_ID: "f47bcbec5e1305efd898d8ca6df425c1",
      INDEXER_URL: ctx.shared.INDEXER_URL,
    },
  });

  return project("launchpad-for-launchpads", {
    resources: [launchpadFactoryApp, launchpadApp, db, staticBucket],
  });
});
