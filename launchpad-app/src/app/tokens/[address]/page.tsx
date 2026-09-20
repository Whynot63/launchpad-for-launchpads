import Link from "next/link";
import { LaunchpadLogo } from "@/components/LaunchpadLogo";
import { Card, Notice, Stat } from "@/components/ui";
import { fetchTokenDetails } from "@/lib/factoryApp";
import { explorerTxUrl } from "@/lib/config";
import { formatAge, formatMarketCap, formatQuoteAmount, formatTokenAmount, formatTokenPrice, shortAddress } from "@/lib/format";
import { fetchToken } from "@/lib/indexer";
import { getCurrentLaunchpad } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: PageProps<"/tokens/[address]">) {
  const launchpad = await getCurrentLaunchpad();
  const { address } = await params;
  const [token, details] = await Promise.all([
    fetchToken(launchpad.address, address).catch(() => undefined),
    fetchTokenDetails(address),
  ]);

  if (!token) {
    return (
      <div className="flex flex-col gap-3 py-10">
        <meta httpEquiv="refresh" content="4" />
        <h1 className="heading text-2xl">Indexing {shortAddress(address)}…</h1>
        <Notice tone="muted">A freshly launched token shows up here within a few seconds. This page refreshes on its own.</Notice>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <Link href="/" className="text-sm text-muted hover:text-white">
          ← {launchpad.name}
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <LaunchpadLogo name={token.symbol} logoUrl={details?.imageUrl ?? ""} accentColor={launchpad.accentColor} size={64} />
          <div className="min-w-0">
            <h1 className="heading text-3xl">
              {token.symbol} <span className="font-normal text-muted">{token.name}</span>
            </h1>
            <p className="mt-1 truncate text-sm text-muted">
              {token.id} · launched {formatAge(token.launchedAt)} ago by {shortAddress(token.creator)}
            </p>
          </div>
        </div>
        {details?.description && <p className="mt-4 max-w-2xl text-muted">{details.description}</p>}
        {details && (
          <p className="mt-3 flex flex-wrap gap-4 text-sm">
            {(
              [
                ["Website", details.website],
                ["X", details.twitter],
                ["Telegram", details.telegram],
              ] as const
            )
              .filter(([, url]) => url)
              .map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  {label}
                </a>
              ))}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Price" value={formatTokenPrice(token.price, token.quoteToken)} />
        <Stat label="Market Cap" value={formatMarketCap(token)} />
        <Stat label="Liquidity" value={formatQuoteAmount(token.liquidity, token.quoteToken)} />
        <Stat label="Volume 24h" value={formatQuoteAmount(token.volume24h, token.quoteToken)} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="heading text-xl">Trades</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted">
              <tr>
                {["Side", token.symbol, "For", "Age", "Transaction"].map((column) => (
                  <th key={column} className="px-6 py-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {token.trades.map((trade) => {
                const isBuy = trade.direction === "buy";
                return (
                  <tr key={trade.id} className="border-t border-line">
                    <td className={`px-6 py-4 font-medium ${isBuy ? "text-success" : "text-danger"}`}>{isBuy ? "Buy" : "Sell"}</td>
                    <td className="px-6 py-4">{formatTokenAmount(isBuy ? trade.amountOut : trade.amountIn)}</td>
                    <td className="px-6 py-4">{formatQuoteAmount(isBuy ? trade.amountIn : trade.amountOut, token.quoteToken)}</td>
                    <td className="px-6 py-4">{formatAge(trade.timestamp)}</td>
                    <td className="px-6 py-4">
                      <a href={explorerTxUrl(trade.tx)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        {shortAddress(trade.tx)}
                      </a>
                    </td>
                  </tr>
                );
              })}
              {token.trades.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={5} className="px-6 py-8 text-center text-muted">
                    No trades yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
