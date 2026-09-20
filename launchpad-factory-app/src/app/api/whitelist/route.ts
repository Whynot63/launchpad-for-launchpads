import whitelist from "@/lib/whitelist.json";

export function GET() {
  return Response.json(whitelist);
}
