import { createClient, http } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { chain } from "./config";

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  client: ({ chain }) => createClient({ chain, transport: http() }),
  ssr: true,
});
