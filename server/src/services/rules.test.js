import { describe, expect, it } from 'vitest';
import { canTransition, checkApartment, votesRequiredFor } from './rules.js';

describe('votesRequiredFor', () => {
  it('считает 20% от числа жителей с округлением вверх', () => {
    expect(votesRequiredFor(10, 20)).toBe(2);
    expect(votesRequiredFor(11, 20)).toBe(3);
    expect(votesRequiredFor(100, 20)).toBe(20);
  });

  it('никогда не меньше одной подписи', () => {
    expect(votesRequiredFor(0, 20)).toBe(1);
    expect(votesRequiredFor(3, 20)).toBe(1);
    expect(votesRequiredFor(5, 0)).toBe(1);
  });
});

describe('canTransition', () => {
  it('разрешает штатный путь заявки', () => {
    expect(canTransition('VOTING', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'DELEGATED')).toBe(true);
    expect(canTransition('DELEGATED', 'RESOLVED')).toBe(true);
  });

  it('запрещает возврат из финальных статусов', () => {
    expect(canTransition('RESOLVED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('REJECTED', 'SUBMITTED')).toBe(false);
    expect(canTransition('EXPIRED', 'VOTING')).toBe(false);
  });

  it('не даёт взять в работу заявку без подписей', () => {
    expect(canTransition('VOTING', 'IN_PROGRESS')).toBe(false);
  });
});

describe('checkApartment', () => {
  const house = {
    apartmentsCount: 80,
    entrances: [
      { number: '1', from: 1, to: 20 },
      { number: '2', from: 21, to: 40 },
      { number: '3', from: 41, to: 60 },
      { number: '4', from: 61, to: 80 },
    ],
  };

  it('находит квартиру и её подъезд', () => {
    expect(checkApartment('27', house)).toEqual({ ok: true, number: 27, entrance: '2', verified: true });
    expect(checkApartment('80', house)).toMatchObject({ ok: true, entrance: '4' });
    expect(checkApartment('15а', house)).toMatchObject({ ok: true, number: 15, entrance: '1' });
  });

  it('отклоняет квартиру, которой нет в доме', () => {
    expect(checkApartment('81', house)).toMatchObject({ ok: false, message: expect.stringContaining('80 квартир') });
    expect(checkApartment('0', house)).toMatchObject({ ok: false });
    expect(checkApartment('abc', house)).toMatchObject({ ok: false });
  });

  it('верит диапазону подъезда, даже если общее число квартир в данных меньше', () => {
    const inconsistent = { apartmentsCount: 64, entrances: [{ number: '4', from: 61, to: 80 }] };
    expect(checkApartment('70', inconsistent)).toMatchObject({ ok: true, entrance: '4' });
    expect(checkApartment('81', inconsistent)).toMatchObject({ ok: false });
  });

  it('проверяет по подъездам, если общее число квартир неизвестно', () => {
    const partial = { apartmentsCount: null, entrances: [{ number: '1', from: 1, to: 20 }] };
    expect(checkApartment('7', partial)).toMatchObject({ ok: true, entrance: '1', verified: true });
    expect(checkApartment('21', partial)).toMatchObject({ ok: false });
  });

  it('принимает без проверки, если о доме ничего не известно', () => {
    expect(checkApartment('999', { apartmentsCount: null, entrances: null })).toEqual({
      ok: true,
      number: 999,
      entrance: null,
      verified: false,
    });
  });
});
