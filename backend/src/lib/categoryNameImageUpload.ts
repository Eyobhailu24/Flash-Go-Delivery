import {
  removeStoredImageAny,
  uploadImageToCloudinary,
} from './cloudinaryImageStorage.js';

export async function saveCategoryNameImage(
  file: File,
): Promise<{ ok: true; publicPath: string } | { ok: false; message: string }> {
  return uploadImageToCloudinary(file, 'category-names');
}

export async function tryRemoveCategoryNameImage(
  stored: string | null,
): Promise<void> {
  await removeStoredImageAny(stored, process.cwd());
}
