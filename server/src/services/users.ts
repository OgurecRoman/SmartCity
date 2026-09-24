import { config } from '../config.js';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import type { Prisma } from '@prisma/client';
import { findBuildingAt, type BuildingInfo } from './geo.js';
import { checkApartment, type ApartmentData, type Entrance } from './rules.js';

export const userInclude = { house: true, company: true } satisfies Prisma.UserInclude;
export type DbUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export interface MaxIdentity {
  maxUserId: bigint;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
}

async function defaultCompanyId(): Promise<number | null> {
  const company = await prisma.managementCompany.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  return company?.id ?? null;
}

export async function upsertFromMax(identity: MaxIdentity): Promise<DbUser> {
  const isAdmin = config.uk.adminIds.includes(identity.maxUserId);
  const lastName = identity.lastName?.trim() || null;
  const username = identity.username?.trim() || null;
  const firstName = identity.firstName.trim() || 'Житель';

  const existing = await prisma.user.findUnique({ where: { maxUserId: identity.maxUserId }, include: userInclude });
  if (existing) {
    const needsRole = isAdmin && existing.role !== 'UK_EMPLOYEE';
    const changed =
      existing.firstName !== firstName || (existing.lastName ?? null) !== lastName || (existing.username ?? null) !== username;
    if (!needsRole && !changed) return existing;
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        username,
        ...(needsRole ? { role: 'UK_EMPLOYEE', companyId: existing.companyId ?? (await defaultCompanyId()) } : {}),
      },
      include: userInclude,
    });
  }

  return prisma.user.create({
    data: {
      maxUserId: identity.maxUserId,
      firstName,
      lastName,
      username,
      role: isAdmin ? 'UK_EMPLOYEE' : 'RESIDENT',
      companyId: isAdmin ? await defaultCompanyId() : null,
    },
    include: userInclude,
  });
}

export async function getUserById(id: number): Promise<DbUser | null> {
  return prisma.user.findUnique({ where: { id }, include: userInclude });
}

export async function getUserByMaxId(maxUserId: bigint): Promise<DbUser | null> {
  return prisma.user.findUnique({ where: { maxUserId }, include: userInclude });
}

export function isEmployee(user: Pick<DbUser, 'role'>): boolean {
  return user.role === 'UK_EMPLOYEE';
}

export function isChairman(user: Pick<DbUser, 'role'>): boolean {
  return user.role === 'CHAIRMAN';
}

/** УК может действовать в любом доме; председатель ТСЖ — только в своём. */
export function canActOnHouse(user: Pick<DbUser, 'role' | 'houseId'>, houseId: number): boolean {
  if (user.role === 'UK_EMPLOYEE') return true;
  return user.role === 'CHAIRMAN' && user.houseId === houseId;
}

/** УК может управлять объявлениями любого дома; председатель ТСЖ — только своего. */
export function canManageAnnouncements(user: Pick<DbUser, 'role' | 'houseId'>, houseId: number): boolean {
  return canActOnHouse(user, houseId);
}

export function isOnboarded(user: Pick<DbUser, 'houseId' | 'onboardedAt'>): boolean {
  return user.houseId !== null && user.onboardedAt !== null;
}

export async function getChairmanOf(houseId: number): Promise<DbUser | null> {
  return prisma.user.findFirst({ where: { role: 'CHAIRMAN', houseId }, include: userInclude });
}

/** Подтверждённый житель добавляет своего съёмщика — сразу, без подтверждения председателя. */
export async function addTenantByOwner(
  owner: Pick<DbUser, 'id' | 'houseId' | 'onboardedAt' | 'residentType'>,
  maxUserId: bigint,
  apartment: string,
): Promise<DbUser> {
  if (owner.residentType !== 'OWNER') throw errors.forbidden('Добавлять съёмщиков может только собственник квартиры');
  if (!owner.houseId || !owner.onboardedAt) throw errors.badRequest('Сначала дождитесь подтверждения от председателя ТСЖ или УК', 'onboarding_required');
  const house = await prisma.house.findUnique({ where: { id: owner.houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const trimmed = apartment.trim();
  if (!trimmed || trimmed.length > 10) throw errors.badRequest('Укажите номер квартиры (до 10 символов)');
  const check = checkApartment(trimmed, apartmentDataOf(house));
  if (!check.ok) throw errors.badRequest(check.message, 'apartment_not_found');

  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (existing?.role === 'UK_EMPLOYEE' || existing?.role === 'CHAIRMAN') {
    throw errors.badRequest('Этого пользователя нельзя добавить жильцом — сначала измените его роль');
  }
  const tenant = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { houseId: house.id, apartment: trimmed, residentType: 'TENANT', onboardedAt: existing.onboardedAt ?? new Date() },
        include: userInclude,
      })
    : await prisma.user.create({
        data: { maxUserId, firstName: 'Житель', houseId: house.id, apartment: trimmed, residentType: 'TENANT', onboardedAt: new Date() },
        include: userInclude,
      });
  events.emit('tenant.added', { houseId: house.id, ownerId: owner.id, tenantId: tenant.id, apartment: trimmed });
  return tenant;
}

export async function promoteToEmployee(userId: number): Promise<DbUser> {
  return prisma.user.update({
    where: { id: userId },
    data: { role: 'UK_EMPLOYEE', companyId: await defaultCompanyId() },
    include: userInclude,
  });
}

export async function assignResidentToHouse(maxUserId: bigint, houseId: number): Promise<DbUser> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { houseId, residentType: existing.residentType ?? 'OWNER', onboardedAt: existing.onboardedAt ?? new Date() },
      include: userInclude,
    });
  }
  return prisma.user.create({
    data: { maxUserId, firstName: 'Житель', houseId, residentType: 'OWNER', onboardedAt: new Date() },
    include: userInclude,
  });
}

export async function detachResident(maxUserId: bigint): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (!existing || existing.houseId === null) throw errors.notFound('Житель с таким ID не привязан к дому');
  return prisma.user.update({
    where: { id: existing.id },
    data: { houseId: null, apartment: null, residentType: null, onboardedAt: null },
    include: userInclude,
  });
}

/** Назначает председателя ТСЖ дома; если человек ещё не привязан к дому — привязывает как владельца. */
export async function appointChairman(maxUserId: bigint, houseId: number): Promise<DbUser> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (existing?.role === 'UK_EMPLOYEE') throw errors.badRequest('Этот пользователь — сотрудник УК, председателем его назначить нельзя');
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'CHAIRMAN',
        houseId,
        residentType: existing.residentType ?? 'OWNER',
        onboardedAt: existing.onboardedAt ?? new Date(),
      },
      include: userInclude,
    });
  }
  return prisma.user.create({
    data: { maxUserId, firstName: 'Житель', role: 'CHAIRMAN', houseId, residentType: 'OWNER', onboardedAt: new Date() },
    include: userInclude,
  });
}

export async function dismissChairman(maxUserId: bigint): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (!existing || existing.role !== 'CHAIRMAN') throw errors.notFound('Председатель ТСЖ с таким ID не найден');
  return prisma.user.update({ where: { id: existing.id }, data: { role: 'RESIDENT' }, include: userInclude });
}

export async function countResidents(houseId: number): Promise<number> {
  return prisma.user.count({ where: { houseId, role: { in: ['RESIDENT', 'CHAIRMAN'] }, onboardedAt: { not: null } } });
}

export const residentSelect = {
  id: true,
  maxUserId: true,
  firstName: true,
  lastName: true,
  username: true,
  apartment: true,
  verifiedFullName: true,
  role: true,
  residentType: true,
} satisfies Prisma.UserSelect;

export type ResidentRow = Prisma.UserGetPayload<{ select: typeof residentSelect }>;

export async function listResidentsOfHouse(houseId: number): Promise<ResidentRow[]> {
  const residents = await prisma.user.findMany({
    where: { houseId, role: { in: ['RESIDENT', 'CHAIRMAN'] }, onboardedAt: { not: null } },
    select: residentSelect,
  });
  return residents.sort((a: any, b: any) => (parseInt(a.apartment ?? '', 10) || 0) - (parseInt(b.apartment ?? '', 10) || 0));
}

export async function listEmployees(): Promise<DbUser[]> {
  return prisma.user.findMany({ where: { role: 'UK_EMPLOYEE' }, include: userInclude, orderBy: { id: 'asc' } });
}

export async function listHouses() {
  return prisma.house.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { residents: true } } } });
}

export async function getHouse(id: number) {
  return prisma.house.findUnique({ where: { id } });
}

export function apartmentDataOf(house: { apartmentsCount: number | null; entrances: unknown }): ApartmentData {
  return { apartmentsCount: house.apartmentsCount, entrances: Array.isArray(house.entrances) ? (house.entrances as Entrance[]) : null };
}

function geoFieldsOf(building: BuildingInfo) {
  return {
    lat: building.lat,
    lng: building.lng,
    apartmentsCount: building.apartmentsCount,
    entrances: building.entrances,
    externalId: building.externalId,
    dataSource: building.source,
  };
}

export async function lookupHouseAt(lat: number, lng: number) {
  const building = await findBuildingAt(lat, lng);
  if (!building) {
    throw errors.notFound('В этой точке не нашли жилой дом с адресом — нажмите точнее на здание', 'building_not_found');
  }
  const house = await prisma.house.findFirst({
    where: { OR: [{ externalId: building.externalId }, { address: { equals: building.address, mode: 'insensitive' } }] },
  });
  return { building, house };
}

export async function findOrCreateHouseAt(lat: number, lng: number) {
  const { building, house } = await lookupHouseAt(lat, lng);
  if (house) {
    const filled = house.externalId ? house : await prisma.house.update({ where: { id: house.id }, data: geoFieldsOf(building) });
    return { house: filled, building, created: false };
  }
  const companyId = await defaultCompanyId();
  if (companyId === null) throw errors.conflict('В базе нет управляющей компании — выполните npm run prisma:seed', 'no_company');
  const created = await prisma.house.create({
    data: { address: building.address, ...geoFieldsOf(building), votePercent: config.votes.defaultPercent, companyId },
  });
  return { house: created, building, created: true };
}

export async function getHouseByChat(chatId: bigint) {
  return prisma.house.findUnique({ where: { chatId } });
}

export async function bindHouseChat(houseId: number, chatId: bigint, chatTitle: string | null) {

  await prisma.house.updateMany({ where: { chatId, NOT: { id: houseId } }, data: { chatId: null, chatTitle: null } });
  return prisma.house.update({ where: { id: houseId }, data: { chatId, chatTitle } });
}

export async function unbindHouseChat(chatId: bigint) {
  await prisma.house.updateMany({ where: { chatId }, data: { chatId: null, chatTitle: null } });
}

export async function getCompany() {
  return prisma.managementCompany.findFirst({ orderBy: { id: 'asc' } });
}

export async function listOrganizations() {
  return prisma.responsibleOrganization.findMany({ orderBy: { id: 'asc' } });
}
