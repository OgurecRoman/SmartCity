import { pluralize } from '../lib/labels.js';

/**
 * Сколько подписей нужно собрать: percent % от числа жителей дома, минимум 1.
 * Автор заявки свою заявку не подписывает.
 */
export function votesRequiredFor(residentsCount, percent) {
  if (residentsCount <= 0) return 1;
  const safePercent = Math.min(100, Math.max(0, percent));
  return Math.max(1, Math.ceil((residentsCount * safePercent) / 100));
}

/** Допустимые переходы статусов. */
export const STATUS_TRANSITIONS = {
  VOTING: ['SUBMITTED', 'REJECTED', 'EXPIRED'],
  SUBMITTED: ['IN_PROGRESS', 'DELEGATED', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['DELEGATED', 'RESOLVED', 'REJECTED'],
  DELEGATED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransition(from, to) {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Статусы, с которыми работает сотрудник УК. */
export const UK_ACTIVE_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'DELEGATED'];

/** Статусы, которые сотрудник УК может выставить вручную. */
export const UK_SETTABLE_STATUSES = ['IN_PROGRESS', 'DELEGATED', 'RESOLVED', 'REJECTED'];

export const FINAL_STATUSES = ['RESOLVED', 'REJECTED', 'EXPIRED'];

/** Автор может удалить заявку, пока она не ушла в УК. */
export const AUTHOR_DELETABLE_STATUSES = ['VOTING', 'EXPIRED'];

/** Подъезд дома с диапазоном квартир */

/**
 * Проверяет, что квартира есть в доме: номер в пределах 1..N (число квартир) и, если известны
 * подъезды, попадает в диапазон одного из них. Если о доме ничего не известно — принимаем без
 * проверки (verified = false). Буква после номера («15а») допускается.
 */
export function checkApartment(apartment, house) {
  const number = Number.parseInt(apartment.trim(), 10);
  if (!Number.isFinite(number) || number < 1) {
    return { ok: false, message: 'Номер квартиры должен начинаться с числа, например 15 или 15а' };
  }
  const count = house.apartmentsCount;
  const entrances = house.entrances ?? [];

  // Диапазон подъезда точнее общего числа квартир (в открытых данных они иногда расходятся)
  const entrance = entrances.find((e) => number >= e.from && number <= e.to);
  if (entrance) return { ok: true, number, entrance: entrance.number, verified: true };

  if (count !== null && number > count) {
    return {
      ok: false,
      message: `В доме ${count} ${pluralize(count, 'квартира', 'квартиры', 'квартир')} (1–${count}), квартиры ${number} нет`,
    };
  }
  if (count === null && entrances.length > 0) {
    const max = Math.max(...entrances.map((e) => e.to));
    return { ok: false, message: `Квартиры ${number} нет ни в одном подъезде (в доме квартиры 1–${max})` };
  }
  return { ok: true, number, entrance: null, verified: count !== null };
}
