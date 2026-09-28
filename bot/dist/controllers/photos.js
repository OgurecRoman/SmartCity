import path from 'node:path';
import { downloadPhoto, uploadPhoto } from '../lib/api.js';
import { log } from '../lib/logger.js';
export async function downloadPhotoFromMax(url) {
    try {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const ext = path.extname(new URL(url).pathname) || '.jpg';
        return await uploadPhoto(buffer, ext);
    }
    catch (error) {
        log.warn(`Не удалось скачать фото из MAX (${url})`, error);
        return null;
    }
}
export async function uploadPhotosToMax(api, filenames) {
    const attachments = [];
    for (const filename of filenames) {
        try {
            const buffer = await downloadPhoto(filename);
            const image = await api.uploadImage({ source: buffer });
            attachments.push(image.toJson());
        }
        catch (error) {
            log.warn(`Не удалось загрузить фото ${filename} в MAX`, error);
        }
    }
    return attachments;
}
//# sourceMappingURL=photos.js.map