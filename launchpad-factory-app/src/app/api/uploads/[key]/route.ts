import { getObject } from "@/lib/storage";
import { LOGO_PATH_PATTERN } from "@/lib/uploads";

export async function GET(_request: Request, { params }: RouteContext<"/api/uploads/[key]">) {
  const { key } = await params;
  if (!LOGO_PATH_PATTERN.test(`/api/uploads/${key}`)) return new Response(null, { status: 404 });

  const stored = await getObject(key);
  if (!stored.ok) return new Response(null, { status: 404 });

  return new Response(stored.body, {
    headers: {
      "content-type": stored.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
