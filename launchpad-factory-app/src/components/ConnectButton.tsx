"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { shortAddress } from "@/lib/format";
import { Button } from "./ui";

export function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  return isConnected && address ? (
    <Button variant="secondary" onClick={() => open({ view: "Account" })}>
      {shortAddress(address)}
    </Button>
  ) : (
    <Button onClick={() => open({ view: "Connect" })}>Connect Wallet</Button>
  );
}
