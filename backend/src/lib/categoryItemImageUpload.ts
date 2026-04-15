import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 5 * 1024 * 1024;

export function uploadRoot(): string {
  return (
    process.env.UPLOAD_ROOT ?? join(process.cwd(), "uploads")
  );
}

/** Map stored public path `/uploads/...` to absolute filesystem path. */
export function fsPathFromStoredPublicPath(
  stored: string | null,
): string | null {
  if (!stored || !stored.startsWith("/uploads/")) return null;
  const rel = stored.replace(/^\//, "");
  return join(process.cwd(), rel);
}

export async function saveCategoryItemImage(
  file: File,
): Promise<
  | { ok: true; publicPath: string }
  | { ok: false; message: string }
> {
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      message: "Image must be JPEG, PNG, WebP, or GIF.",
    };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return { ok: false, message: "Empty image file." };
  }
  if (buf.length > MAX_BYTES) {
    return {
      ok: false,
      message: "Image too large (maximum 5MB).",
    };
  }

  const ext = EXT_BY_MIME[mime] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const subdir = join(uploadRoot(), "category-items");
  await mkdir(subdir, { recursive: true });
  const absPath = join(subdir, filename);
  await writeFile(absPath, buf);

  const publicPath = `/uploads/category-items/${filename}`;
  return { ok: true, publicPath };
}

export async function tryRemoveStoredImage(
  stored: string | null,
): Promise<void> {
  const abs = fsPathFromStoredPublicPath(stored);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* ignore missing file */
  }
}
