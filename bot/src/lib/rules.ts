import type { DbUser, RequestStatus } from '../types/index.js';
import { pluralize } from './labels.js';

// Чистые правила без обращения к БД — копия соответствующих частей server/src/services/rules.ts и users.ts.

export const UK_ACTIVE_STATUSES: readonly RequestStatus[] = ['SUBMITTED', 'IN_PROGRESS', 'DELEGATED'];
export const AUTHOR_DELETABLE_STATUSES: readonly RequestStatus[] = ['VOTING', 'EXPIRED'];
export const REOPEN_WINDOW_DAYS = 7;
export const MAX_PHOTOS_PER_ITEM = 5;

export function isEmployee(user: Pick<DbUser, 'role'>): boolean {
  return user.role === 'UK_EMPLOYEE';
}

export function isChairman(user: Pick<DbUser, 'role'>): boolean {
  return user.role === 'CHAIRMAN';
}

export function isOnboarded(user: Pick<DbUser, 'houseId' | 'onboardedAt'>): boolean {
  return user.houseId !== null && user.onboardedAt !== null;
}

export type Entrance = { number: string; from: number; to: number };

export interface ApartmentData {
  apartmentsCount: number | null;
  entrances: Entrance[] | null;
}

export type ApartmentCheck =
  | { ok: true; number: number; entrance: string | null; verified: boolean }
  | { ok: false; message: string };

export function apartmentDataOf(house: { apartmentsCount: number | null; entrances: unknown }): ApartmentData {
  return { apartmentsCount: house.apartmentsCount, entrances: Array.isArray(house.entrances) ? (house.entrances as Entrance[]) : null };
}

export function checkApartment(apartment: string, house: ApartmentData): ApartmentCheck {
  const number = Number.parseInt(apartment.trim(), 10);
  if (!Number.isFinite(number) || number < 1) {
    return { ok: false, message: 'Номер квартиры должен начинаться с числа, например 15 или 15а' };
  }
  const count = house.apartmentsCount;
  const entrances = house.entrances ?? [];

  const entrance = entrances.find((e) => number >= e.from && number <= e.to);
  if (entrance) return { ok: true, number, entrance: entrance.number, verified: true };

  if (count !== null && number > count) {
    return { ok: false, message: `В доме ${count} ${pluralize(count, 'квартира', 'квартиры', 'квартир')} (1–${count}), квартиры ${number} нет` };
  }
  if (count === null && entrances.length > 0) {
    const max = Math.max(...entrances.map((e) => e.to));
    return { ok: false, message: `Квартиры ${number} нет ни в одном подъезде (в доме квартиры 1–${max})` };
  }
  return { ok: true, number, entrance: null, verified: count !== null };
}
