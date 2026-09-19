import { describe, expect, it } from 'vitest';
import { parseFlats, parseNominatim, parseOverpass } from './geo.js';

// Упрощённый ответ Overpass (out body geom) для Волгоградской, 5 и соседнего дома 7 (Казань):
// прямоугольные контуры вокруг реальных центров зданий
const rect = (lat, lon, dLat = 0.0002, dLon = 0.0006) => [
  { lat: lat - dLat, lon: lon - dLon },
  { lat: lat - dLat, lon: lon + dLon },
  { lat: lat + dLat, lon: lon + dLon },
  { lat: lat + dLat, lon: lon - dLon },
  { lat: lat - dLat, lon: lon - dLon },
];
const elements = [
  {
    type: 'way',
    id: 61424311,
    geometry: rect(55.8285919, 49.0850117),
    nodes: [1, 2, 3, 4, 5],
    tags: {
      building: 'apartments',
      'addr:street': 'Волгоградская улица',
      'addr:housenumber': '5',
      'building:flats': '80',
      'building:levels': '5',
    },
  },
  {
    type: 'way',
    id: 61424423,
    geometry: rect(55.8288311, 49.0855945),
    nodes: [9],
    tags: { building: 'apartments', 'addr:street': 'Волгоградская улица', 'addr:housenumber': '7', 'building:flats': '80' },
  },
  { type: 'node', id: 1, tags: { entrance: 'staircase', ref: '1', 'addr:flats': '1-20' } },
  { type: 'node', id: 2, tags: { entrance: 'staircase', ref: '2', 'addr:flats': '21-40' } },
  { type: 'node', id: 3, tags: { entrance: 'staircase', ref: '2', 'addr:flats': '21-40' } }, // вторая дверь того же подъезда
  { type: 'node', id: 4, tags: { entrance: 'staircase', ref: '3', 'addr:flats': '41-60' } },
  { type: 'node', id: 9, tags: { entrance: 'staircase', ref: '1', 'addr:flats': '1-40' } }, // подъезд другого дома
];

describe('parseOverpass', () => {
  it('берёт здание, внутри которого точка, число квартир и подъезды без дублей', () => {
    // край дома 5, до центра дома 7 отсюда ближе, чем до центра дома 5
    const building = parseOverpass(elements, 55.82875, 49.08555);
    expect(building).toMatchObject({
      externalId: 'osm:way/61424311',
      source: 'osm',
      address: 'Волгоградская улица, 5',
      apartmentsCount: 80,
    });
    expect(building?.lat).toBeCloseTo(55.8285919, 5);
    expect(building?.lng).toBeCloseTo(49.0850117, 5);
    expect(building?.entrances).toEqual([
      { number: '1', from: 1, to: 20 },
      { number: '2', from: 21, to: 40 },
      { number: '3', from: 41, to: 60 },
    ]);
  });

  it('если нажали рядом с домами — берёт ближайший по центру', () => {
    expect(parseOverpass(elements, 55.8289, 49.0864)?.address).toBe('Волгоградская улица, 7');
    expect(parseOverpass(elements, 55.8285, 49.0842)?.address).toBe('Волгоградская улица, 5');
  });

  it('возвращает null без зданий и null-число квартир без тега building:flats', () => {
    expect(parseOverpass([], 55.8, 49.1)).toBeNull();
    const noFlats = [{ type: 'way', id: 7, geometry: rect(55.8, 49.1), tags: { building: 'yes', 'addr:housenumber': '3' } }];
    expect(parseOverpass(noFlats, 55.8, 49.1)).toMatchObject({ address: 'дом 3', apartmentsCount: null, entrances: [] });
  });
});

describe('parseFlats', () => {
  it('разбирает диапазоны и одиночные номера', () => {
    expect(parseFlats('1-20', '1')).toEqual([{ number: '1', from: 1, to: 20 }]);
    expect(parseFlats('1-20;21-40', '2')).toHaveLength(2);
    expect(parseFlats('25', undefined)).toEqual([{ number: '', from: 25, to: 25 }]);
    expect(parseFlats('n/a', '1')).toEqual([]);
  });
});

describe('parseNominatim', () => {
  it('берёт адрес и число квартир из ответа обратного геокодирования', () => {
    const place = {
      osm_type: 'way',
      osm_id: 61424311,
      lat: '55.8286213',
      lon: '49.0849988',
      address: { road: 'Волгоградская улица', house_number: '5', city: 'Казань' },
      extratags: { 'building:flats': '80', 'building:levels': '5' },
    };
    expect(parseNominatim(place)).toEqual({
      externalId: 'osm:way/61424311',
      source: 'osm',
      address: 'Волгоградская улица, 5',
      lat: 55.8286213,
      lng: 49.0849988,
      apartmentsCount: 80,
      entrances: [],
    });
  });

  it('возвращает null без номера дома или при ошибке', () => {
    expect(parseNominatim({ error: 'Unable to geocode' })).toBeNull();
    expect(parseNominatim({ osm_type: 'way', osm_id: 1, address: { road: 'Парковая' } })).toBeNull();
  });
});
