import { factoryAppUrl } from "@/lib/config";
import { buttonClass } from "./ui";

export function ClaimLaunchpad({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-start gap-5 py-16">
      <p className="eyebrow">Available</p>
      <h1 className="heading max-w-2xl text-4xl sm:text-5xl">
        <span className="text-brand">{slug}</span> Is Not Taken Yet.
      </h1>
      <p className="max-w-xl text-muted">
        No launchpad lives at this address. Create yours here: pick a name, keep this subdomain, and go live in two clicks.
      </p>
      <a href={`${factoryAppUrl}/create?slug=${encodeURIComponent(slug)}`} className={buttonClass()}>
        Create Launchpad
      </a>
    </div>
  );
}
