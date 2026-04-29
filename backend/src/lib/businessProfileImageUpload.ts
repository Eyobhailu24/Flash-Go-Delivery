import {
  removeStoredImageAny,
  uploadImageToCloudinary,
} from './cloudinaryImageStorage.js';

export async function saveBusinessProfileImage(
  file: File,
): Promise<{ ok: true; publicPath: string } | { ok: false; message: string }> {
  return uploadImageToCloudinary(file, 'business-profiles');
}

export async function tryRemoveBusinessProfileImage(
  stored: string | null,
): Promise<void> {
  await removeStoredImageAny(stored, process.cwd());
}
