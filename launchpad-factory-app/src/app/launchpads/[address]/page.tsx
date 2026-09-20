import Link from "next/link";
import { notFound } from "next/navigation";
import { LaunchpadLogo } from "@/components/LaunchpadLogo";
import { Card, Stat, buttonClass } from "@/components/ui";
import { launchpadDomain, launchpadUrl } from "@/lib/config";
import { findLaunchpad } from "@/lib/db";
import { formatCompact, formatQuoteAmount, formatTokenPrice, formatUsd, shortAddress } from "@/lib/format";
import { fetchIndexedLaunchpad } from "@/lib/indexer";

export const dynamic = "force-dynamic";

export default async function LaunchpadStatsPage({ params }: PageProps<"/launchpads/[address]">) {
  const launchpad = await findLaunchpad((await params).address);
  if (!launchpad) notFound();

  const indexed = await fetchIndexedLaunchpad(launchpad.address).catch(() => undefined);
  const tokens = indexed?.tokens ?? [];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <LaunchpadLogo {...launchpad} size={64} />
          <div>
            <h1 className="heading text-3xl">{launchpad.name}</h1>
            <p className="text-sm text-muted">
              {launchpad.slug}.{launchpadDomain} · owner {shortAddress(launchpad.owner)}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/launchpads/${launchpad.address}/edit`} className={buttonClass("secondary")}>
            Edit
          </Link>
          <a target="_blank" href={launchpadUrl(launchpad.slug)} className={buttonClass()}>
            Open Launchpad
          </a>
        </div>
      </section>

      {launchpad.description && <p className="max-w-2xl text-muted">{launchpad.description}</p>}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Tokens Launched" value={indexed?.numTokens ?? 0} />
        <Stat label="Volume 24h" value={formatUsd(indexed?.volumeUsd24h)} />
        <Stat label="Trades 24h" value={formatCompact(indexed?.numTrades24h ?? 0)} />
        <Stat label="Total Volume" value={formatUsd(indexed?.volumeUsd)} />
      </section>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted">
            <tr>
              {["Token", "Price", "Liquidity", "Volume 24h", "Trades 24h", "Total Volume"].map((column) => (
                <th key={column} className="px-6 py-4 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id} className="border-t border-line">
                <td className="px-6 py-4">
                  <span className="font-medium">{token.symbol}</span> <span className="text-muted">{token.name}</span>
                </td>
                <td className="px-6 py-4">{formatTokenPrice(token.price, token.quoteToken)}</td>
                <td className="px-6 py-4">{formatQuoteAmount(token.liquidity, token.quoteToken)}</td>
                <td className="px-6 py-4">{formatQuoteAmount(token.volume24h, token.quoteToken)}</td>
                <td className="px-6 py-4">{token.numTrades24h}</td>
                <td className="px-6 py-4">{formatQuoteAmount(token.volume, token.quoteToken)}</td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr className="border-t border-line">
                <td colSpan={6} className="px-6 py-8 text-center text-muted">
                  {indexed ? "No tokens launched yet." : "Statistics appear once the indexer picks up this launchpad."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
