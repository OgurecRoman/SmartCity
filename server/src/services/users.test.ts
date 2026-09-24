import { describe, expect, it } from 'vitest';
import { canManageAnnouncements, isChairman, isEmployee } from './users.js';

describe('isEmployee / isChairman', () => {
  it('различает роли', () => {
    expect(isEmployee({ role: 'UK_EMPLOYEE' })).toBe(true);
    expect(isEmployee({ role: 'RESIDENT' })).toBe(false);
    expect(isEmployee({ role: 'CHAIRMAN' })).toBe(false);
    expect(isChairman({ role: 'CHAIRMAN' })).toBe(true);
    expect(isChairman({ role: 'RESIDENT' })).toBe(false);
  });
});

describe('canManageAnnouncements', () => {
  it('УК может публиковать объявления в любом доме', () => {
    expect(canManageAnnouncements({ role: 'UK_EMPLOYEE', houseId: null }, 1)).toBe(true);
    expect(canManageAnnouncements({ role: 'UK_EMPLOYEE', houseId: 5 }, 1)).toBe(true);
  });

  it('председатель ТСЖ — только в своём доме', () => {
    expect(canManageAnnouncements({ role: 'CHAIRMAN', houseId: 1 }, 1)).toBe(true);
    expect(canManageAnnouncements({ role: 'CHAIRMAN', houseId: 2 }, 1)).toBe(false);
    expect(canManageAnnouncements({ role: 'CHAIRMAN', houseId: null }, 1)).toBe(false);
  });

  it('обычный житель не может управлять объявлениями', () => {
    expect(canManageAnnouncements({ role: 'RESIDENT', houseId: 1 }, 1)).toBe(false);
  });
});
