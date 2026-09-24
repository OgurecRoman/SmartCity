import path from 'node:path';
import multer from 'multer';
import { errors } from './errors.js';
import { ALLOWED_PHOTO_EXTENSIONS, MAX_PHOTOS_PER_ITEM, MAX_PHOTO_SIZE_BYTES, savePhotoBuffer } from './photoStorage.js';

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES, files: MAX_PHOTOS_PER_ITEM },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PHOTO_EXTENSIONS.includes(ext)) {
      callback(errors.badRequest('Допустимые форматы фото: jpg, png, webp, gif'));
      return;
    }
    callback(null, true);
  },
});

export async function saveUploadedPhotos(files: Express.Multer.File[] | undefined): Promise<string[]> {
  if (!files || files.length === 0) return [];
  const filenames: string[] = [];
  for (const file of files) {
    filenames.push(await savePhotoBuffer(file.buffer, path.extname(file.originalname)));
  }
  return filenames;
}
