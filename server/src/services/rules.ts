import type { RequestStatus } from '@prisma/client';
import { pluralize } from '../lib/labels.js';

export function votesRequiredFor(residentsCount: number, percent: number): number {
  if (residentsCount <= 0) return 1;
  const safePercent = Math.min(100, Math.max(0, percent));
  return Math.max(1, Math.ceil((residentsCount * safePercent) / 100));
}

export const STATUS_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  VOTING: ['SUBMITTED', 'REJECTED', 'EXPIRED'],
  SUBMITTED: ['IN_PROGRESS', 'DELEGATED', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['DELEGATED', 'RESOLVED', 'REJECTED'],
  DELEGATED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export const UK_ACTIVE_STATUSES: readonly RequestStatus[] = ['SUBMITTED', 'IN_PROGRESS', 'DELEGATED'];

export const UK_SETTABLE_STATUSES: readonly RequestStatus[] = ['IN_PROGRESS', 'DELEGATED', 'RESOLVED', 'REJECTED'];

export const FINAL_STATUSES: readonly RequestStatus[] = ['RESOLVED', 'REJECTED', 'EXPIRED'];

export const AUTHOR_DELETABLE_STATUSES: readonly RequestStatus[] = ['VOTING', 'EXPIRED'];

export type Entrance = { number: string; from: number; to: number };

export interface ApartmentData {
  apartmentsCount: number | null;
  entrances: Entrance[] | null;
}

export type ApartmentCheck =
  | { ok: true; number: number; entrance: string | null; verified: boolean }
  | { ok: false; message: string };

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
