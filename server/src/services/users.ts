import { config } from '../config.js';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import type { Prisma, ResidentType } from '@prisma/client';
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

// --- Дома жителя (UserHouse). User.houseId и связанные поля — «активный» дом. ---

export const userHouseInclude = {
  house: { select: { id: true, address: true, votePercent: true, lat: true, lng: true, apartmentsCount: true, chatId: true } },
} satisfies Prisma.UserHouseInclude;
export type UserHouseRow = Prisma.UserHouseGetPayload<{ include: typeof userHouseInclude }>;

export async function listUserHouses(userId: number): Promise<UserHouseRow[]> {
  return prisma.userHouse.findMany({ where: { userId }, include: userHouseInclude, orderBy: { joinedAt: 'asc' } });
}

export async function isMemberOfHouse(userId: number, houseId: number): Promise<boolean> {
  return (await prisma.userHouse.count({ where: { userId, houseId } })) > 0;
}

/**
 * Дом, с которым работает запрос: УК обязан указать houseId; житель может указать любой из своих домов,
 * иначе берётся активный. С allowPending дома из ожидающих заявок на вступление тоже подходят (для чтения).
 */
export async function resolveHouseFor(
  user: Pick<DbUser, 'id' | 'role' | 'houseId' | 'onboardedAt'>,
  requested: number | undefined,
  options: { allowPending?: boolean } = {},
): Promise<number> {
  if (user.role === 'UK_EMPLOYEE') {
    if (!requested) throw errors.badRequest('Укажите дом (houseId)');
    return requested;
  }
  if (requested !== undefined) {
    if (await isMemberOfHouse(user.id, requested)) return requested;
    if (options.allowPending) {
      const pending = await prisma.membershipRequest.count({ where: { applicantId: user.id, houseId: requested, status: 'PENDING' } });
      if (pending > 0) return requested;
    }
    throw errors.forbidden('Это не ваш дом');
  }
  if (user.houseId && user.onboardedAt) return user.houseId;
  if (options.allowPending) {
    const pending = await prisma.membershipRequest.findFirst({
      where: { applicantId: user.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { houseId: true },
    });
    if (pending) return pending.houseId;
  }
  throw errors.badRequest('Сначала дождитесь подтверждения от председателя ТСЖ или УК', 'onboarding_required');
}

interface JoinHouseInput {
  userId: number;
  houseId: number;
  apartment: string | null;
  residentType: ResidentType;
  verifiedFullName?: string | null;
}

/** Добавляет дом в список жителя; если активного дома ещё нет — этот становится активным. */
async function joinHouseTx(tx: Prisma.TransactionClient, input: JoinHouseInput): Promise<void> {
  await tx.userHouse.upsert({
    where: { userId_houseId: { userId: input.userId, houseId: input.houseId } },
    create: {
      userId: input.userId,
      houseId: input.houseId,
      apartment: input.apartment,
      residentType: input.residentType,
      verifiedFullName: input.verifiedFullName ?? null,
    },
    update: {
      apartment: input.apartment,
      residentType: input.residentType,
      ...(input.verifiedFullName ? { verifiedFullName: input.verifiedFullName } : {}),
    },
  });
  const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
  const makeActive = !user.houseId || !user.onboardedAt || user.houseId === input.houseId;
  if (makeActive) {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        houseId: input.houseId,
        apartment: input.apartment,
        residentType: input.residentType,
        onboardedAt: user.onboardedAt ?? new Date(),
        ...(input.verifiedFullName ? { verifiedFullName: input.verifiedFullName } : {}),
      },
    });
  }
}

export async function joinHouse(input: JoinHouseInput): Promise<DbUser> {
  await prisma.$transaction((tx) => joinHouseTx(tx, input));
  return prisma.user.findUniqueOrThrow({ where: { id: input.userId }, include: userInclude });
}

/** Переключает активный дом жителя на один из его домов. */
export async function setActiveHouse(userId: number, houseId: number): Promise<DbUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('Пользователь не найден');
  const membership = await prisma.userHouse.findUnique({ where: { userId_houseId: { userId, houseId } } });
  if (!membership) throw errors.forbidden('Это не ваш дом');
  if (user.role === 'CHAIRMAN' && user.houseId !== houseId) {
    throw errors.conflict('Председатель ТСЖ привязан к своему дому — сначала снимите его с должности', 'chairman_bound');
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      houseId,
      apartment: membership.apartment,
      residentType: membership.residentType,
      verifiedFullName: membership.verifiedFullName ?? user.verifiedFullName,
      onboardedAt: user.onboardedAt ?? new Date(),
    },
    include: userInclude,
  });
}

/** Убирает дом из списка жителя; если он был активным — активным становится следующий (или никакой). */
export async function leaveHouse(userId: number, houseId: number): Promise<DbUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('Пользователь не найден');
  const membership = await prisma.userHouse.findUnique({ where: { userId_houseId: { userId, houseId } } });
  if (!membership) throw errors.notFound('Житель не привязан к этому дому');
  if (user.role === 'CHAIRMAN' && user.houseId === houseId) {
    throw errors.conflict('Председатель ТСЖ не может покинуть свой дом — сначала снимите его с должности', 'chairman_bound');
  }
  return prisma.$transaction(async (tx) => {
    await tx.userHouse.delete({ where: { id: membership.id } });
    if (user.houseId !== houseId) return tx.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
    const next = await tx.userHouse.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } });
    return tx.user.update({
      where: { id: userId },
      data: next
        ? { houseId: next.houseId, apartment: next.apartment, residentType: next.residentType }
        : { houseId: null, apartment: null, residentType: null, onboardedAt: null },
      include: userInclude,
    });
  });
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
  const tenantId = existing?.id ?? (await prisma.user.create({ data: { maxUserId, firstName: 'Житель' } })).id;
  const tenant = await joinHouse({ userId: tenantId, houseId: house.id, apartment: trimmed, residentType: 'TENANT' });
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

async function ensureUser(maxUserId: bigint): Promise<{ id: number; role: string; residentType: ResidentType | null }> {
  const existing = await prisma.user.findUnique({ where: { maxUserId }, select: { id: true, role: true, residentType: true } });
  return existing ?? (await prisma.user.create({ data: { maxUserId, firstName: 'Житель' }, select: { id: true, role: true, residentType: true } }));
}

/** УК добавляет жителя в дом (без подтверждения); дом становится активным, если активного ещё нет. */
export async function assignResidentToHouse(maxUserId: bigint, houseId: number): Promise<DbUser> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const user = await ensureUser(maxUserId);
  return joinHouse({ userId: user.id, houseId, apartment: null, residentType: user.residentType ?? 'OWNER' });
}

/** УК убирает жителя из дома (по умолчанию — из активного). Председателя этого дома заодно снимает с должности. */
export async function detachResident(maxUserId: bigint, houseId?: number): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  const target = houseId ?? existing?.houseId ?? null;
  if (!existing || target === null) throw errors.notFound('Житель с таким ID не привязан к дому');
  if (existing.role === 'CHAIRMAN' && existing.houseId === target) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'RESIDENT' } });
  }
  return leaveHouse(existing.id, target);
}

/** Назначает председателя ТСЖ дома; если человек ещё не привязан к дому — привязывает как владельца. Дом становится активным. */
export async function appointChairman(maxUserId: bigint, houseId: number): Promise<DbUser> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const user = await ensureUser(maxUserId);
  if (user.role === 'UK_EMPLOYEE') throw errors.badRequest('Этот пользователь — сотрудник УК, председателем его назначить нельзя');
  await joinHouse({ userId: user.id, houseId, apartment: null, residentType: user.residentType ?? 'OWNER' });
  await prisma.user.update({ where: { id: user.id }, data: { role: 'RESIDENT' } });
  const active = await setActiveHouse(user.id, houseId);
  return prisma.user.update({ where: { id: active.id }, data: { role: 'CHAIRMAN' }, include: userInclude });
}

export async function dismissChairman(maxUserId: bigint): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (!existing || existing.role !== 'CHAIRMAN') throw errors.notFound('Председатель ТСЖ с таким ID не найден');
  return prisma.user.update({ where: { id: existing.id }, data: { role: 'RESIDENT' }, include: userInclude });
}

const residentRoles: Prisma.UserWhereInput = { role: { in: ['RESIDENT', 'CHAIRMAN'] } };

export async function countResidents(houseId: number): Promise<number> {
  return prisma.userHouse.count({ where: { houseId, user: residentRoles } });
}

export interface ResidentRow {
  id: number;
  maxUserId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  apartment: string | null;
  verifiedFullName: string | null;
  role: DbUser['role'];
  residentType: ResidentType | null;
}

/** Жители дома — все, у кого дом есть в списке (не только те, у кого он активный). */
export async function listResidentsOfHouse(houseId: number): Promise<ResidentRow[]> {
  const rows = await prisma.userHouse.findMany({
    where: { houseId, user: residentRoles },
    include: { user: { select: { id: true, maxUserId: true, firstName: true, lastName: true, username: true, role: true } } },
  });
  const residents: ResidentRow[] = rows.map((row) => ({
    ...row.user,
    apartment: row.apartment,
    verifiedFullName: row.verifiedFullName,
    residentType: row.residentType,
  }));
  return residents.sort((a, b) => (parseInt(a.apartment ?? '', 10) || 0) - (parseInt(b.apartment ?? '', 10) || 0));
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

export async function setVotePercent(houseId: number, percent: number) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw errors.badRequest('Процент должен быть целым числом от 0 до 100');
  }
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  return prisma.house.update({ where: { id: houseId }, data: { votePercent: percent } });
}

/** Удаляет дом, только если с ним ничего не связано (жители, заявки, объявления, новости, вступления, камеры). */
export async function deleteHouse(houseId: number): Promise<void> {
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    include: { _count: { select: { userHouses: true, residents: true, requests: true, announcements: true, news: true, membershipRequests: true, cameras: true } } },
  });
  if (!house) throw errors.notFound('Дом не найден');
  const used = Object.entries(house._count).filter(([, count]) => count > 0);
  if (used.length > 0) {
    throw errors.conflict(`Дом нельзя удалить: с ним связаны данные (${used.map(([name, count]) => `${name}: ${count}`).join(', ')})`, 'house_in_use');
  }
  await prisma.house.delete({ where: { id: houseId } });
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
