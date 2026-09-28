import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export const MAX_PHOTOS_PER_ITEM = 5;
export const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const s3Client = new S3Client({
    region: 'ru-1',
    endpoint: 'https://s3.ru1.storage.beget.cloud',
    credentials: {
        accessKeyId: 'RQ1DBLURGB3CZBZZ53UH',
        secretAccessKey: 'tEd6d37G3jmUIGtHR7WXzzxOghfZlMBoiPFrPMpt',
    },
    forcePathStyle: true,
});

const BUCKET = '58b38eef4985-smartcity';
const PUBLIC_URL = 'https://58b38eef4985-smartcity.s3.ru1.storage.beget.cloud';

/**
 * Сохраняет фото в S3 в папку 'photos/', но возвращает ТОЛЬКО имя файла.
 * Это необходимо, чтобы пройти валидацию Zod (/^[\w.-]+$/).
 */
export async function savePhotoBuffer(buffer: Buffer, ext: string): Promise<string> {
    const safeExt = ALLOWED_PHOTO_EXTENSIONS.includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
    const filename = `${crypto.randomUUID()}${safeExt}`;
    const key = `photos/${filename}`;

    const contentTypeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.webp': 'image/webp', '.gif': 'image/gif',
    };

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentTypeMap[safeExt],
        })
    );

    // Возвращаем ТОЛЬКО имя файла для сохранения в БД
    return filename;
}

export function photoUrlPath(filename: string): string {
    return `${PUBLIC_URL}/photos/${filename}`;
}

export async function deletePhotoFile(filename: string): Promise<void> {
    const key = `photos/${filename}`;
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}
