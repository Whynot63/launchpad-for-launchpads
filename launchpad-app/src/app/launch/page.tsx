import { LaunchTokenForm } from "@/components/LaunchTokenForm";
import { fetchQuoteTokens } from "@/lib/factoryApp";
import { getCurrentLaunchpad } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

export default async function LaunchTokenPage() {
  const [launchpad, quoteTokens] = await Promise.all([getCurrentLaunchpad(), fetchQuoteTokens()]);
  return <LaunchTokenForm launchpad={launchpad.address} accentColor={launchpad.accentColor} quoteTokens={quoteTokens} />;
}
