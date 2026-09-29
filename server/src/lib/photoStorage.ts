import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js'; // <-- 1. Импортируем конфиг

export const MAX_PHOTOS_PER_ITEM = 5;
export const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// <-- 2. Используем значения из config.s3
const s3Client = new S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint,
    credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true, // Обязательно для Beget
});

const BUCKET = config.s3.bucket;
const PUBLIC_URL = config.s3.publicUrl;

/**
 * Сохраняет фото в S3 в папку 'photos/', но возвращает ТОЛЬКО имя файла.
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
            ACL: 'public-read',
        })
    );

    // Возвращаем ТОЛЬКО имя файла для сохранения в БД
    return filename;
}

/**
 * Превращает имя файла в полную публичную ссылку.
 */
export function photoUrlPath(filename: string): string {
    return `${PUBLIC_URL}/photos/${filename}`;
}

/**
 * Удаляет фото из S3.
 */
export async function deletePhotoFile(filename: string): Promise<void> {
    const key = `photos/${filename}`;
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
}