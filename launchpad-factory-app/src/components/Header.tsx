import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="border-b border-line/70 bg-ink/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/xxx-logo.svg" alt="XXX" width={129} height={24} priority />
          <span className="hidden border-l border-line pl-3 text-sm text-muted sm:block">Launchpad Factory</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link href="/" className="px-2 text-muted transition hover:text-white">
            Launchpads
          </Link>
          <Link href="/create" className="px-2 text-muted transition hover:text-white">
            Create
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
