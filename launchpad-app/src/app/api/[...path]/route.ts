import { FACTORY_APP_INTERNAL_URL } from "@/lib/factoryApp";

const PROXIED_APIS = ["uploads", "tokens"];

const forward = async (request: Request, { params }: RouteContext<"/api/[...path]">) => {
  const { path } = await params;
  if (!PROXIED_APIS.includes(path[0])) return new Response(null, { status: 404 });

  const upstream = await fetch(`${FACTORY_APP_INTERNAL_URL}/api/${path.join("/")}${new URL(request.url).search}`, {
    method: request.method,
    headers: { "content-type": request.headers.get("content-type") ?? "" },
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": upstream.headers.get("cache-control") ?? "no-store",
    },
  });
};

export { forward as GET, forward as POST };
