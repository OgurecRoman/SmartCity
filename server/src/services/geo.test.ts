import { describe, expect, it, vi, beforeEach } from 'vitest';
import { findBuildingAt, searchAddress } from './geo.js';

vi.mock('../config.js', () => ({
    config: {
        geo: {
            yandexApiKey: 'test-yandex-api-key',
            yandexGeocoderUrl: 'https://geocode-maps.yandex.ru/1.x/',
        },
    },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('findBuildingAt (Яндекс.Геокодер)', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('находит здание по координатам и формирует правильный адрес', async () => {
        // Имитируем успешный ответ от Яндекс.Геокодера
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                response: {
                    GeoObjectCollection: {
                        featureMember: [
                            {
                                GeoObject: {
                                    name: '5',
                                    description: 'г Казань, Волгоградская улица',
                                    Point: { pos: '49.0850117 55.8285919' }, // Формат Яндекса: "долгота широта"
                                },
                            },
                        ],
                    },
                },
            }),
        });

        const building = await findBuildingAt(55.8285919, 49.0850117);

        expect(building).not.toBeNull();
        expect(building).toMatchObject({
            source: 'yandex',
            address: 'г Казань, Волгоградская улица, 5',
            apartmentsCount: null, // Яндекс не отдает количество квартир
            entrances: [],         // Яндекс не отдает подъезды
        });
        expect(building?.lat).toBeCloseTo(55.8285919, 5);
        expect(building?.lng).toBeCloseTo(49.0850117, 5);
        expect(building?.externalId).toContain('yandex:');
    });

    it('возвращает null, если Яндекс ничего не нашел по координатам', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                response: {
                    GeoObjectCollection: {
                        featureMember: [], // Пустой ответ
                    },
                },
            }),
        });

        const building = await findBuildingAt(0, 0);
        expect(building).toBeNull();
    });

    it('выдает ошибку, если Яндекс вернул статус не 200', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
        });

        await expect(findBuildingAt(55, 49)).rejects.toThrow('Яндекс.Геокодер ответил 403');
    });
});

describe('searchAddress (Яндекс.Геокодер)', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('ищет адрес по строке и возвращает массив результатов', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                response: {
                    GeoObjectCollection: {
                        featureMember: [
                            {
                                GeoObject: {
                                    name: '1',
                                    description: 'г Москва, ул Тверская',
                                    Point: { pos: '37.6116 55.7580' },
                                },
                            },
                        ],
                    },
                },
            }),
        });

        const results = await searchAddress('Москва, ул Тверская, 1');

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            label: 'г Москва, ул Тверская, 1',
            lat: 55.7580,
            lng: 37.6116,
        });
    });

    it('возвращает пустой массив для слишком короткого запроса (меньше 3 символов)', async () => {
        const results = await searchAddress('аб');

        expect(results).toEqual([]);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});