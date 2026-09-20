import { findToken } from "@/lib/db";

export async function GET(_request: Request, { params }: RouteContext<"/api/tokens/[address]">) {
  const token = await findToken((await params).address);
  return token ? Response.json(token) : Response.json({ error: "Token details not found" }, { status: 404 });
}
