import { join } from 'node:path';
import {
  removeStoredImageAny,
  uploadImageToCloudinary,
} from './cloudinaryImageStorage.js';

export function uploadRoot(): string {
  return (
    process.env.UPLOAD_ROOT ?? join(process.cwd(), 'uploads')
  );
}

/** Map stored public path `/uploads/...` to absolute filesystem path (legacy rows). */
export function fsPathFromStoredPublicPath(
  stored: string | null,
): string | null {
  if (!stored || !stored.startsWith('/uploads/')) return null;
  const rel = stored.replace(/^\//, '');
  return join(process.cwd(), rel);
}

export async function saveCategoryItemImage(
  file: File,
): Promise<
  { ok: true; publicPath: string } | { ok: false; message: string }
> {
  return uploadImageToCloudinary(file, 'category-items');
}

export async function tryRemoveStoredImage(
  stored: string | null,
): Promise<void> {
  await removeStoredImageAny(stored, process.cwd());
}
