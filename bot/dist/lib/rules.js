import { pluralize } from './labels.js';
export const UK_ACTIVE_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'DELEGATED'];
export const AUTHOR_DELETABLE_STATUSES = ['VOTING', 'EXPIRED'];
export const REOPEN_WINDOW_DAYS = 7;
export const MAX_PHOTOS_PER_ITEM = 5;
export function isEmployee(user) {
    return user.role === 'UK_EMPLOYEE';
}
export function isChairman(user) {
    return user.role === 'CHAIRMAN';
}
export function isOnboarded(user) {
    return user.houseId !== null && user.onboardedAt !== null;
}
export function apartmentDataOf(house) {
    return { apartmentsCount: house.apartmentsCount, entrances: Array.isArray(house.entrances) ? house.entrances : null };
}
export function checkApartment(apartment, house) {
    const number = Number.parseInt(apartment.trim(), 10);
    if (!Number.isFinite(number) || number < 1) {
        return { ok: false, message: 'Номер квартиры должен начинаться с числа, например 15 или 15а' };
    }
    const count = house.apartmentsCount;
    const entrances = house.entrances ?? [];
    const entrance = entrances.find((e) => number >= e.from && number <= e.to);
    if (entrance)
        return { ok: true, number, entrance: entrance.number, verified: true };
    if (count !== null && number > count) {
        return { ok: false, message: `В доме ${count} ${pluralize(count, 'квартира', 'квартиры', 'квартир')} (1–${count}), квартиры ${number} нет` };
    }
    if (count === null && entrances.length > 0) {
        const max = Math.max(...entrances.map((e) => e.to));
        return { ok: false, message: `Квартиры ${number} нет ни в одном подъезде (в доме квартиры 1–${max})` };
    }
    return { ok: true, number, entrance: null, verified: count !== null };
}
//# sourceMappingURL=rules.js.map