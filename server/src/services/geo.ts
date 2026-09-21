import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import type { Entrance } from './rules.js';

export interface BuildingInfo {

  externalId: string;
  source: 'osm';
  address: string;
  lat: number;
  lng: number;
  apartmentsCount: number | null;
  entrances: Entrance[];
}

type Point = { lat: number; lon: number };

export interface OverpassElement {
  type: 'way' | 'node' | 'relation';
  id: number;
  tags?: Record<string, string>;
  nodes?: number[];

  geometry?: Point[];
}

const SEARCH_RADIUS_M = 40;

export async function findBuildingAt(lat: number, lng: number): Promise<BuildingInfo | null> {
  for (const url of config.geo.overpassUrls) {
    try {
      return await queryOverpass(url, lat, lng);
    } catch (error) {
      log.warn(`Overpass ${url} недоступен: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    log.warn('Все серверы Overpass недоступны — берём дом из Nominatim (без подъездов)');
    return await reverseGeocode(lat, lng);
  } catch (error) {
    log.error('Nominatim тоже недоступен', error);
    throw errors.unavailable('Сервис карт временно недоступен — попробуйте ещё раз через минуту');
  }
}

async function queryOverpass(url: string, lat: number, lng: number): Promise<BuildingInfo | null> {
  const query = `[out:json][timeout:10];
way(around:${SEARCH_RADIUS_M},${lat},${lng})["building"]["addr:housenumber"]->.b;
(.b; node(w.b)["entrance"];);
out body geom;`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SmartCity-MAX/0.1' },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`ответил ${response.status}`);
  const json = (await response.json()) as { elements?: OverpassElement[] };
  return parseOverpass(json.elements ?? [], lat, lng);
}

export interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
  error?: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<BuildingInfo | null> {
  const url = new URL(`${config.geo.nominatimUrl}/reverse`);
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '18',
    layer: 'address',
    extratags: '1',
    'accept-language': 'ru',
  }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'SmartCity-MAX/0.1' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Nominatim ответил ${response.status}`);
  return parseNominatim((await response.json()) as NominatimPlace);
}

export function parseNominatim(place: NominatimPlace): BuildingInfo | null {
  const number = place.address?.house_number;
  if (place.error || !number || !place.osm_type || !place.osm_id) return null;
  const street = place.address?.road ?? place.address?.pedestrian ?? place.address?.suburb ?? '';
  const flats = Number.parseInt(place.extratags?.['building:flats'] ?? '', 10);
  return {
    externalId: `osm:${place.osm_type}/${place.osm_id}`,
    source: 'osm',
    address: street ? `${street}, ${number}` : `дом ${number}`,
    lat: Number(place.lat),
    lng: Number(place.lon),
    apartmentsCount: Number.isFinite(flats) && flats > 0 ? flats : null,
    entrances: [],
  };
}

export function parseOverpass(elements: OverpassElement[], lat: number, lng: number): BuildingInfo | null {
  const buildings = elements.filter((el) => el.type === 'way' && el.geometry?.length && el.tags?.['addr:housenumber']);
  if (buildings.length === 0) return null;
  const nearest =
    buildings.find((way) => containsPoint(way.geometry!, lat, lng)) ??
    buildings.reduce((best, way) =>
      distanceM(lat, lng, centerOf(way.geometry!)) < distanceM(lat, lng, centerOf(best.geometry!)) ? way : best,
    );
  const center = centerOf(nearest.geometry!);
  const tags = nearest.tags!;
  const nodeIds = new Set(nearest.nodes ?? []);
  const entrances = elements
    .filter((el) => el.type === 'node' && nodeIds.has(el.id) && el.tags?.['addr:flats'])
    .flatMap((node) => parseFlats(node.tags!['addr:flats'], node.tags!.ref));
  const flats = Number.parseInt(tags['building:flats'] ?? '', 10);

  return {
    externalId: `osm:way/${nearest.id}`,
    source: 'osm',
    address: formatAddress(tags),
    lat: center.lat,
    lng: center.lon,
    apartmentsCount: Number.isFinite(flats) && flats > 0 ? flats : null,
    entrances: dedupeEntrances(entrances),
  };
}

export function parseFlats(value: string, ref: string | undefined): Entrance[] {
  const result: Entrance[] = [];
  for (const part of value.split(/[;,]/)) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!match) continue;
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (to >= from) result.push({ number: ref?.trim() || '', from, to });
  }
  return result;
}

function dedupeEntrances(entrances: Entrance[]): Entrance[] {
  const seen = new Set<string>();
  return entrances
    .filter((e) => {
      const key = `${e.number}:${e.from}-${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.from - b.from);
}

function formatAddress(tags: Record<string, string>): string {
  const street = tags['addr:street'] ?? tags['addr:place'] ?? '';
  const number = tags['addr:housenumber'];
  return street ? `${street}, ${number}` : `дом ${number}`;
}

function containsPoint(polygon: Point[], lat: number, lng: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.lat > lat !== b.lat > lat && lng < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

function centerOf(polygon: Point[]): Point {
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  const points = polygon.length > 1 && first.lat === last.lat && first.lon === last.lon ? polygon.slice(0, -1) : polygon;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
  return { lat: sum.lat / points.length, lon: sum.lon / points.length };
}

function distanceM(lat: number, lng: number, point: Point): number {
  const toRad = Math.PI / 180;
  const x = (point.lon - lng) * toRad * Math.cos(((lat + point.lat) / 2) * toRad);
  const y = (point.lat - lat) * toRad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

export interface AddressHit {
  label: string;
  lat: number;
  lng: number;
}

export async function searchAddress(query: string): Promise<AddressHit[]> {
  const url = new URL(`${config.geo.nominatimUrl}/search`);
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', countrycodes: 'ru' }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'SmartCity-MAX/0.1', 'Accept-Language': 'ru' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Nominatim ответил ${response.status}`);
  const hits = (await response.json()) as { display_name: string; lat: string; lon: string }[];
  return hits.map((hit) => ({ label: hit.display_name, lat: Number(hit.lat), lng: Number(hit.lon) }));
}
