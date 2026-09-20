import Link from "next/link";
import { type Launchpad, logoSrc } from "@/lib/launchpad";
import { ConnectButton } from "./ConnectButton";
import { LaunchpadLogo } from "./LaunchpadLogo";

export function Header({ launchpad }: { launchpad: Launchpad }) {
  return (
    <header className="border-b border-line/70 bg-ink/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <LaunchpadLogo name={launchpad.name} logoUrl={logoSrc(launchpad)} accentColor={launchpad.accentColor} size={32} />
          <span className="heading truncate text-base">{launchpad.name}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link href="/" className="px-2 text-muted transition hover:text-white">
            Tokens
          </Link>
          <Link href="/launch" className="px-2 text-muted transition hover:text-white">
            Launch
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
