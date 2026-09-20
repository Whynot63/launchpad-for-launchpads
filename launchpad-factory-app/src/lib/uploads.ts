export const MAX_LOGO_BYTES = 1024 * 1024;

export const LOGO_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const LOGO_PATH_PATTERN = /^\/api\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

export const logoError = (file: { type: string; size: number }) => {
  if (!LOGO_EXTENSION_BY_TYPE[file.type]) return "Logo must be a PNG, JPEG, WebP, or GIF image";
  if (file.size > MAX_LOGO_BYTES) return "Logo must be at most 1 MB";
  return null;
};
