import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

const FOLDER_PREFIX = 'flash-go';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 5 * 1024 * 1024;

let configured = false;

export function ensureCloudinaryConfigured(): void {
  if (configured) return;
  cloudinary.config(true);
  const cfg = cloudinary.config();
  if (!cfg.cloud_name) {
    const cloud_name =
      process.env.CLOUDINARY_CLOUD_NAME ?? process.env.CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud_name || !api_key || !api_secret) {
      throw new Error(
        'Cloudinary is not configured. Set CLOUDINARY_URL, or CLOUD_NAME (or CLOUDINARY_CLOUD_NAME), CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
    cloudinary.config({ cloud_name, api_key, api_secret });
  }
  configured = true;
}

export type ImageUploadKind =
  | 'category-items'
  | 'business-profiles'
  | 'category-names';

export async function uploadImageToCloudinary(
  file: File,
  kind: ImageUploadKind,
): Promise<
  { ok: true; publicPath: string } | { ok: false; message: string }
> {
  ensureCloudinaryConfigured();

  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      message: 'Image must be JPEG, PNG, WebP, or GIF.',
    };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return { ok: false, message: 'Empty image file.' };
  }
  if (buf.length > MAX_BYTES) {
    return { ok: false, message: 'Image too large (maximum 5MB).' };
  }

  const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
  const folder = `${FOLDER_PREFIX}/${kind}`;
  const public_id = randomUUID();

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id,
      resource_type: 'image',
      overwrite: false,
    });
    const url = result.secure_url;
    if (!url || typeof url !== 'string') {
      return {
        ok: false,
        message: 'Upload succeeded but no image URL was returned.',
      };
    }
    return { ok: true, publicPath: url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Cloudinary upload failed.';
    return { ok: false, message: msg };
  }
}

function isCloudinaryStored(stored: string): boolean {
  try {
    const u = new URL(stored);
    return (
      u.hostname === 'res.cloudinary.com' ||
      u.hostname.endsWith('.res.cloudinary.com')
    );
  } catch {
    return false;
  }
}

/**
 * Derive public_id from a delivery URL. Strips transformation segments (e.g. f_auto,q_auto),
 * version tokens (v123…), then removes the file extension from the last segment.
 */
function publicIdFromCloudinaryUrl(urlStr: string): string | null {
  try {
    const pathname = new URL(urlStr).pathname;
    const marker = '/image/upload/';
    const pos = pathname.indexOf(marker);
    if (pos === -1) return null;
    let segs = pathname
      .slice(pos + marker.length)
      .split('/')
      .filter(Boolean);
    segs = segs.filter((s) => !/^v\d+$/i.test(s) && !s.includes(','));
    if (segs.length === 0) return null;
    const last = segs[segs.length - 1]!;
    const withoutExt = last.includes('.')
      ? last.replace(/\.[^.]+$/, '')
      : last;
    return decodeURIComponent([...segs.slice(0, -1), withoutExt].join('/'));
  } catch {
    return null;
  }
}

export function fsPathFromLegacyUploadsPath(
  stored: string | null,
  cwd: string,
): string | null {
  if (!stored || !stored.startsWith('/uploads/')) return null;
  const rel = stored.replace(/^\//, '');
  return join(cwd, rel);
}

export async function removeStoredImageAny(
  stored: string | null,
  cwd: string,
): Promise<void> {
  if (!stored) return;
  if (isCloudinaryStored(stored)) {
    ensureCloudinaryConfigured();
    const publicId = publicIdFromCloudinaryUrl(stored);
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
    } catch {
      /* ignore */
    }
    return;
  }
  const abs = fsPathFromLegacyUploadsPath(stored, cwd);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* ignore missing file */
  }
}
