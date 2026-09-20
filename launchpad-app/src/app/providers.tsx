"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { factoryAppUrl } from "@/lib/config";
import { networks, reownProjectId, wagmiAdapter, wagmiConfig } from "@/lib/wagmi";

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: reownProjectId,
  metadata: {
    name: "Launchpad",
    description: "Launch and discover tokens.",
    url: factoryAppUrl,
    icons: [`${factoryAppUrl}/mark.svg`],
  },
  themeMode: "dark",
  themeVariables: { "--w3m-accent": "#9CD6FF", "--w3m-font-family": "var(--font-poppins)" },
  features: { analytics: false, email: false, socials: [] },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
