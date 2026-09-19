import { findLaunchpad } from "@/lib/db";

export async function GET(_request: Request, { params }: RouteContext<"/api/launchpads/[address]">) {
  const launchpad = await findLaunchpad((await params).address);
  return launchpad ? Response.json(launchpad) : Response.json({ error: "Launchpad not found" }, { status: 404 });
}
