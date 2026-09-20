import Link from "next/link";
import { LaunchpadLogo } from "@/components/LaunchpadLogo";
import { Card, buttonClass } from "@/components/ui";
import { launchpadDomain } from "@/lib/config";
import { formatUsd } from "@/lib/format";
import { listLaunchpads } from "@/lib/db";
import { type IndexedLaunchpad, fetchIndexedLaunchpads } from "@/lib/indexer";

export const dynamic = "force-dynamic";

export default async function LaunchpadsPage() {
  const [launchpads, indexed] = await Promise.all([
    listLaunchpads(),
    fetchIndexedLaunchpads().catch((): IndexedLaunchpad[] => []),
  ]);
  const statsByLaunchpad = new Map(indexed.map((launchpad) => [launchpad.id.toLowerCase(), launchpad]));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-start gap-5 py-6">
        <p className="eyebrow">Launchpad as a Service</p>
        <h1 className="heading max-w-2xl text-4xl sm:text-5xl">Your Own Token Launchpad, Live in Two Clicks.</h1>
        <p className="max-w-xl text-muted">
          Pick a name and a subdomain. We handle the contracts, liquidity, and indexing — you run the community.
        </p>
        <Link href="/create" className={buttonClass()}>
          Create Launchpad
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="heading text-xl">Launchpads</h2>
        {launchpads.length === 0 ? (
          <Card className="text-sm text-muted">No launchpads yet. Yours can be the first one.</Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {launchpads.map((launchpad) => {
              const stats = statsByLaunchpad.get(launchpad.address);
              return (
                <li key={launchpad.address}>
                  <Link
                    href={`/launchpads/${launchpad.address}`}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface/80 p-5 transition hover:border-brand/60"
                  >
                    <div className="flex items-center gap-4">
                      <LaunchpadLogo {...launchpad} />
                      <div className="min-w-0">
                        <p className="heading truncate text-lg">{launchpad.name}</p>
                        <p className="truncate text-sm text-muted">
                          {launchpad.slug}.{launchpadDomain}
                        </p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Tokens</dt>
                        <dd>{stats?.numTokens ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Volume 24h</dt>
                        <dd>{formatUsd(stats?.volumeUsd24h)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Trades 24h</dt>
                        <dd>{stats?.numTrades24h ?? 0}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
