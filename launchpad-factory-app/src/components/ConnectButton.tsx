"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "@/lib/format";
import { Button } from "./ui";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button variant="secondary" onClick={() => disconnect()} title="Disconnect">
        {shortAddress(address)}
      </Button>
    );
  }
  return (
    <Button disabled={isPending || connectors.length === 0} onClick={() => connect({ connector: connectors[0] })}>
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
