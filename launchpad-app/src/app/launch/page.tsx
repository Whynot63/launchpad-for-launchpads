import { LaunchTokenForm } from "@/components/LaunchTokenForm";
import { getCurrentLaunchpad } from "@/lib/launchpad";

export const dynamic = "force-dynamic";

export default async function LaunchTokenPage() {
  const launchpad = await getCurrentLaunchpad();
  return <LaunchTokenForm launchpad={launchpad.address} launchpadName={launchpad.name} />;
}
