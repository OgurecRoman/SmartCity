import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_PHOTOS_PER_ITEM = 5;
export const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const UPLOADS_DIR = path.resolve(import.meta.dirname, '..', '..', 'uploads', 'photos');

export function photoFsPath(filename: string): string {
  return path.join(UPLOADS_DIR, filename);
}

export function photoUrlPath(filename: string): string {
  return `/uploads/photos/${filename}`;
}

export async function savePhotoBuffer(buffer: Buffer, ext: string): Promise<string> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const safeExt = ALLOWED_PHOTO_EXTENSIONS.includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
  const filename = `${crypto.randomUUID()}${safeExt}`;
  await fs.writeFile(photoFsPath(filename), buffer);
  return filename;
}

export async function deletePhotoFile(filename: string): Promise<void> {
  await fs.unlink(photoFsPath(filename)).catch(() => {});
}
