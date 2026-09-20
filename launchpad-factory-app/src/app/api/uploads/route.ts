import { putObject } from "@/lib/storage";
import { LOGO_EXTENSION_BY_TYPE, logoError } from "@/lib/uploads";

export async function POST(request: Request) {
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Attach an image file" }, { status: 400 });

  const invalid = logoError(file);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const key = `${crypto.randomUUID()}.${LOGO_EXTENSION_BY_TYPE[file.type]}`;
  await putObject(key, await file.arrayBuffer(), file.type);
  return Response.json({ logoUrl: `/api/uploads/${key}` });
}
