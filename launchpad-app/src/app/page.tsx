import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";
import { formatAge, formatMarketCap, formatQuoteAmount, formatTokenPrice } from "@/lib/format";
import { type IndexedToken, fetchLaunchpadTokens } from "@/lib/indexer";
import { getCurrentLaunchpad } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const launchpad = await getCurrentLaunchpad();
  const tokens = await fetchLaunchpadTokens(launchpad.address).catch((): IndexedToken[] | undefined => undefined);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-start gap-5 py-6">
        <h1 className="heading max-w-2xl text-4xl sm:text-5xl">{launchpad.name}</h1>
        {launchpad.description && <p className="max-w-xl text-muted">{launchpad.description}</p>}
        <Link href="/launch" className={buttonClass()}>
          Launch Token
        </Link>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="heading text-xl">Tokens</h2>
        {!tokens || tokens.length === 0 ? (
          <Card className="text-sm text-muted">
            {tokens ? "No tokens yet. Launch the first one." : "Token data is unavailable right now. Try again in a moment."}
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted">
                <tr>
                  {["Token", "Price", "Market Cap", "Volume 24h", "Trades 24h", "Age"].map((column) => (
                    <th key={column} className="px-6 py-4 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id} className="border-t border-line transition hover:bg-raised/60">
                    <td className="px-6 py-4">
                      <Link href={`/tokens/${token.id}`} className="font-medium hover:text-brand">
                        {token.symbol} <span className="font-normal text-muted">{token.name}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4">{formatTokenPrice(token.price, token.quoteToken)}</td>
                    <td className="px-6 py-4">{formatMarketCap(token)}</td>
                    <td className="px-6 py-4">{formatQuoteAmount(token.volume24h, token.quoteToken)}</td>
                    <td className="px-6 py-4">{token.numTrades24h}</td>
                    <td className="px-6 py-4">{formatAge(token.launchedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
