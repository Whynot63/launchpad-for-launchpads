import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { type AppKitNetwork, baseSepolia, foundry } from "@reown/appkit/networks";
import { chain } from "./config";

export const reownProjectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [chain.id === foundry.id ? foundry : baseSepolia];

export const wagmiAdapter = new WagmiAdapter({ networks, projectId: reownProjectId, ssr: true });

export const wagmiConfig = wagmiAdapter.wagmiConfig;
