import path from 'node:path';
import type { Api } from '@maxhub/max-bot-api';
import type { AttachmentRequest } from '@maxhub/max-bot-api/types';
import { downloadPhoto, uploadPhoto } from '../lib/api.js';
import { log } from '../lib/logger.js';

/** Скачивает фото из MAX и передаёт его на хранение бэкенду; возвращает имя файла на сервере. */
export async function downloadPhotoFromMax(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    return await uploadPhoto(buffer, ext);
  } catch (error) {
    log.warn(`Не удалось скачать фото из MAX (${url})`, error);
    return null;
  }
}

/** Берёт файлы с бэкенда и загружает их в MAX как вложения к сообщению. */
export async function uploadPhotosToMax(api: Api, filenames: string[]): Promise<AttachmentRequest[]> {
  const attachments: AttachmentRequest[] = [];
  for (const filename of filenames) {
    try {
      const buffer = await downloadPhoto(filename);
      const image = await api.uploadImage({ source: buffer });
      attachments.push(image.toJson());
    } catch (error) {
      log.warn(`Не удалось загрузить фото ${filename} в MAX`, error);
    }
  }
  return attachments;
}
