import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import type { Entrance } from './rules.js';

export interface BuildingInfo {
    externalId: string;
    source: 'yandex';
    address: string;
    lat: number;
    lng: number;
    apartmentsCount: number | null;
    entrances: Entrance[];
}

export interface AddressHit {
    label: string;
    lat: number;
    lng: number;
}

interface YandexGeoResponse {
    response?: {
        GeoObjectCollection?: {
            metaDataProperty?: {
                GeocoderResponseMetaData?: {
                    found?: string;
                    request?: string;
                };
            };
            featureMember?: YandexFeatureMember[];
        };
    };
    error?: {
        status_code?: number;
        message?: string;
    };
}

interface YandexFeatureMember {
    GeoObject: {
        metaDataProperty?: {
            GeocoderMetaData?: {
                text?: string;
                kind?: 'country' | 'province' | 'area' | 'locality' | 'district' | 'street' | 'house' | 'station' | 'metro' | 'other';
                precision?: 'exact' | 'near' | 'range' | 'other';
                Address?: {
                    formatted?: string;
                    country_code?: string;
                    postal_code?: string;
                    Components?: Array<{
                        kind?: string;
                        name?: string;
                    }>;
                };
            };
        };
        name?: string;
        description?: string;
        Point?: {
            pos?: string;
        };
        boundedBy?: {
            Envelope?: {
                lowerCorner?: string;
                upperCorner?: string;
            };
        };
    };
}

export function shortenAddress(fullAddress: string): string {
    if (!fullAddress) return fullAddress;

    let cleaned = fullAddress.trim();

    const noisePatterns = [
        /^Россия\s*,?\s*/i,
        /^Российская\s+Федерация\s*,?\s*/i,
        /^Республика\s+Татарстан\s*,?\s*/i,
        /^Татарстан\s*,?\s*/i,
    ];
    for (const pattern of noisePatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    const abbreviations: [RegExp, string][] = [
        [/\bгород\s+/gi, 'г. '],
        [/\bулица\s+/gi, 'ул. '],
        [/\bпроспект\s+/gi, 'пр. '],
        [/\bпереулок\s+/gi, 'пер. '],
        [/\bплощадь\s+/gi, 'пл. '],
        [/\bбульвар\s+/gi, 'б-р '],
        [/\bнабережная\s+/gi, 'наб. '],
        [/\bшоссе\s+/gi, 'ш. '],
        [/\bдом\s+/gi, 'д. '],
        [/\bкорпус\s+/gi, 'к. '],
        [/\bстроение\s+/gi, 'стр. '],
    ];
    for (const [pattern, abbr] of abbreviations) {
        cleaned = cleaned.replace(pattern, abbr);
    }

    // 3. Чистим форматирование (убираем двойные запятые, пробелы и висячие знаки)
    cleaned = cleaned
        .replace(/,\s*,/g, ',') // Двойные запятые
        .replace(/^,\s*/, '')   // Запятая в начале строки
        .replace(/,\s*$/, '')   // Запятая в конце строки
        .replace(/\s{2,}/g, ' ') // Двойные и более пробелы
        .trim();

    return cleaned;
}

export async function findBuildingAt(lat: number, lng: number): Promise<BuildingInfo | null> {
    if (!config.geo.yandexApiKey) {
        throw errors.unavailable('Ключ Яндекс.Геокодера не настроен');
    }

    const geocode = `${lng},${lat}`;
    const url = new URL(config.geo.yandexGeocoderUrl);
    url.search = new URLSearchParams({
        apikey: config.geo.yandexApiKey,
        geocode,
        format: 'json',
        results: '1',
        kind: 'house',
        lang: 'ru_RU',
    }).toString();

    const response = await fetch(url, {
        headers: { 'User-Agent': 'SmartCity-MAX/0.1' },
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw errors.unavailable(`Яндекс.Геокодер ответил ${response.status}`);
    }

    const json = (await response.json()) as YandexGeoResponse;
    return parseYandexBuilding(json, lat, lng);
}

function parseYandexBuilding(
    json: YandexGeoResponse,
    originalLat: number,
    originalLng: number,
): BuildingInfo | null {
    const member = json.response?.GeoObjectCollection?.featureMember?.[0];
    const geo = member?.GeoObject;
    if (!geo) return null;

    const pos = geo.Point?.pos?.split(/\s+/) ?? [];
    if (pos.length < 2) return null;
    const lng = Number(pos[0]);
    const lat = Number(pos[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const description = geo.description ?? '';
    const name = geo.name ?? '';

    const rawAddress = description && name ? `${description}, ${name}` : description || name || 'Неизвестный адрес';
    const address = shortenAddress(rawAddress);

    const externalId = `yandex:${lng.toFixed(6)},${lat.toFixed(6)}`;

    return {
        externalId,
        source: 'yandex',
        address, // <-- Теперь здесь короткий адрес
        lat,
        lng,
        apartmentsCount: null,
        entrances: [],
    };
}

export async function searchAddress(query: string): Promise<AddressHit[]> {
    if (!config.geo.yandexApiKey) {
        throw errors.unavailable('Ключ Яндекс.Геокодера не настроен');
    }

    if (!query || query.trim().length < 3) {
        return [];
    }

    const url = new URL(config.geo.yandexGeocoderUrl);
    url.search = new URLSearchParams({
        apikey: config.geo.yandexApiKey,
        geocode: query.trim(),
        format: 'json',
        results: '5',
        lang: 'ru_RU',
    }).toString();

    const response = await fetch(url, {
        headers: { 'User-Agent': 'SmartCity-MAX/0.1' },
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw errors.unavailable(`Яндекс.Геокодер ответил ${response.status}`);
    }

    const json = (await response.json()) as YandexGeoResponse;
    const members = json.response?.GeoObjectCollection?.featureMember ?? [];

    return members
        .map((m) => {
            const geo = m.GeoObject;
            if (!geo?.Point?.pos) return null;
            const [lngStr, latStr] = geo.Point.pos.split(/\s+/);
            const lng = Number(lngStr);
            const lat = Number(latStr);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            const description = geo.description ?? '';
            const name = geo.name ?? '';

            const rawLabel = description && name ? `${description}, ${name}` : description || name;
            const label = rawLabel ? shortenAddress(rawLabel) : null;

            if (!label) return null;

            return { label, lat, lng };
        })
        .filter((h): h is AddressHit => h !== null);
}