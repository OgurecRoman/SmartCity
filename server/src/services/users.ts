import { config } from '../config.js';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import type { Prisma, ResidentType } from '@prisma/client';
import { findBuildingAt, type BuildingInfo } from './geo.js';
import { checkApartment, type ApartmentData, type Entrance } from './rules.js';
import { createCompany } from './companies.js';
import { fullName } from '../lib/labels.js';

export const userInclude = { house: true, company: true } satisfies Prisma.UserInclude;
export type DbUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export interface MaxIdentity {
  maxUserId: bigint;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
}

async function defaultCompanyId(): Promise<number | null> {
  let company = await prisma.managementCompany.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (!company) company = await createCompany({ name: 'Новая управляющая компания', phone: '' });
  return company?.id ?? null;
}

const DEFAULT_ORG_SPECS = [
  { name: 'Лифтовая служба «ЛифтСервис»', email: 'lift@example.org', phone: '+7 (800) 555-35-35', categories: ['ELEVATOR'] as const },
  { name: 'МУП «Водоканал»', email: 'dispatch@vodokanal.example', phone: '+7 (666) 666-66-66', categories: ['PLUMBING'] as const },
  { name: 'АО «Сетевая компания»', email: 'avaria@setevaya.example', phone: '+7 (777) 777-77-77', categories: ['ELECTRICITY'] as const },
  { name: 'Подрядчик по текущему ремонту', email: 'remont@example.org', phone: null, categories: ['REPAIR', 'CLEANING'] as const },
  { name: 'Участковый уполномоченный', email: 'uchastok@example.org', phone: '102', categories: ['NOISE', 'SECURITY'] as const },
];

async function provisionCompanyForEmployee(user: {
  id: number;
  firstName: string;
  lastName?: string | null;
}): Promise<number> {
  const label = fullName(user).trim() || `сотрудник #${user.id}`;
  const company = await createCompany({
    name: `УК «${label}»`,
    phone: '',
    email: null,
    address: null,
    workingHours: 'Пн–Пт 9:00–18:00',
  });

  const templateCompanyId = await prisma.managementCompany.findFirst({
    where: { id: { not: company.id } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  const templates = templateCompanyId
    ? await prisma.responsibleOrganization.findMany({ where: { companyId: templateCompanyId.id } })
    : [];

  if (templates.length > 0) {
    await prisma.responsibleOrganization.createMany({
      data: templates.map((org) => ({
        companyId: company.id,
        name: org.name,
        email: org.email,
        phone: org.phone,
        categories: org.categories,
      })),
    });
  } else {
    await prisma.responsibleOrganization.createMany({
      data: DEFAULT_ORG_SPECS.map((org) => ({
        companyId: company.id,
        name: org.name,
        email: org.email,
        phone: org.phone,
        categories: [...org.categories],
      })),
    });
  }

  return company.id;
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
    const companyId = needsRole
      ? existing.companyId ?? (await provisionCompanyForEmployee({ id: existing.id, firstName, lastName }))
      : undefined;
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        username,
        ...(needsRole ? { role: 'UK_EMPLOYEE', companyId, chairmanHouseId: null } : {}),
      },
      include: userInclude,
    });
  }

  if (isAdmin) {
    const created = await prisma.user.create({
      data: {
        maxUserId: identity.maxUserId,
        firstName,
        lastName,
        username,
        role: 'RESIDENT',
      },
      include: userInclude,
    });
    const companyId = await provisionCompanyForEmployee(created);
    return prisma.user.update({
      where: { id: created.id },
      data: { role: 'UK_EMPLOYEE', companyId },
      include: userInclude,
    });
  }

  return prisma.user.create({
    data: {
      maxUserId: identity.maxUserId,
      firstName,
      lastName,
      username,
      role: 'RESIDENT',
      companyId: null,
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

export function canActOnHouse(
  user: Pick<DbUser, 'role' | 'houseId' | 'companyId' | 'chairmanHouseId'>,
  houseId: number,
  houseCompanyId?: number | null,
): boolean {
  if (user.role === 'UK_EMPLOYEE') {
    if (user.companyId == null) return false;
    if (houseCompanyId == null) return true;
    return houseCompanyId === user.companyId;
  }
  return user.role === 'CHAIRMAN' && user.chairmanHouseId === houseId;
}

export function canManageAnnouncements(
  user: Pick<DbUser, 'role' | 'houseId' | 'companyId' | 'chairmanHouseId'>,
  houseId: number,
  houseCompanyId?: number | null,
): boolean {
  return canActOnHouse(user, houseId, houseCompanyId);
}

export async function assertEmployeeHouseAccess(
  user: Pick<DbUser, 'role' | 'companyId'>,
  houseId: number,
): Promise<void> {
  if (!isEmployee(user)) return;
  if (user.companyId == null) throw errors.forbidden('Сотрудник УК не привязан к компании');
  const house = await prisma.house.findUnique({ where: { id: houseId }, select: { companyId: true } });
  if (!house) throw errors.notFound('Дом не найден');
  if (house.companyId !== user.companyId) {
    throw errors.forbidden('Этот дом обслуживает другая УК', 'other_company_house');
  }
}

export function isOnboarded(user: Pick<DbUser, 'houseId' | 'onboardedAt'>): boolean {
  return user.houseId !== null && user.onboardedAt !== null;
}

export async function getChairmanOf(houseId: number): Promise<DbUser | null> {
  return prisma.user.findFirst({ where: { role: 'CHAIRMAN', chairmanHouseId: houseId }, include: userInclude });
}

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

export async function resolveHouseFor(
  user: Pick<DbUser, 'id' | 'role' | 'houseId' | 'onboardedAt' | 'companyId'>,
  requested: number | undefined,
  options: { allowPending?: boolean } = {},
): Promise<number> {
  if (user.role === 'UK_EMPLOYEE') {
    if (!requested) throw errors.badRequest('Укажите дом (houseId)');
    await assertEmployeeHouseAccess(user, requested);
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

export async function setActiveHouse(userId: number, houseId: number): Promise<DbUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw errors.notFound('Пользователь не найден');

  if (isEmployee(user)) {
    await assertEmployeeHouseAccess(user, houseId);
    return prisma.user.update({
      where: { id: userId },
      data: { houseId },
      include: userInclude,
    });
  }

  const membership = await prisma.userHouse.findUnique({ where: { userId_houseId: { userId, houseId } } });
  if (!membership) throw errors.forbidden('Это не ваш дом');
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

export async function leaveHouse(userId: number, houseId: number): Promise<DbUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw errors.notFound('Пользователь не найден');
  const membership = await prisma.userHouse.findUnique({ where: { userId_houseId: { userId, houseId } } });
  if (!membership) throw errors.notFound('Житель не привязан к этому дому');
  if (user.chairmanHouseId === houseId) {
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
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw errors.notFound('Пользователь не найден');
  if (user.role === 'UK_EMPLOYEE' && user.companyId != null) return user;

  const companyId = user.companyId ?? (await provisionCompanyForEmployee(user));
  return prisma.user.update({
    where: { id: userId },
    data: { role: 'UK_EMPLOYEE', companyId, chairmanHouseId: null },
    include: userInclude,
  });
}

export async function logout(userId: number): Promise<DbUser> {
  return prisma.user.update({
    where: { id: userId },
    data: { role: 'RESIDENT', chairmanHouseId: null },
    include: userInclude,
  });
}

async function ensureUser(maxUserId: bigint): Promise<{ id: number; role: string; residentType: ResidentType | null }> {
  const existing = await prisma.user.findUnique({ where: { maxUserId }, select: { id: true, role: true, residentType: true } });
  return existing ?? (await prisma.user.create({ data: { maxUserId, firstName: 'Житель' }, select: { id: true, role: true, residentType: true } }));
}

export async function assignResidentToHouse(maxUserId: bigint, houseId: number): Promise<DbUser> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const user = await ensureUser(maxUserId);
  return joinHouse({ userId: user.id, houseId, apartment: null, residentType: user.residentType ?? 'OWNER' });
}

export async function detachResident(maxUserId: bigint, houseId?: number): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  const target = houseId ?? existing?.houseId ?? null;
  if (!existing || target === null) throw errors.notFound('Житель с таким ID не привязан к дому');
  if (existing.chairmanHouseId === target) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'RESIDENT', chairmanHouseId: null } });
  }
  return leaveHouse(existing.id, target);
}

export async function appointChairman(maxUserId: bigint, houseId: number): Promise<DbUser> {
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const user = await ensureUser(maxUserId);
  if (user.role === 'UK_EMPLOYEE') throw errors.badRequest('Этот пользователь — сотрудник УК, председателем его назначить нельзя');
  await joinHouse({ userId: user.id, houseId, apartment: null, residentType: user.residentType ?? 'OWNER' });

  await prisma.user.updateMany({
    where: { OR: [{ chairmanHouseId: houseId }, { id: user.id, role: 'CHAIRMAN' }] },
    data: { role: 'RESIDENT', chairmanHouseId: null },
  });

  await setActiveHouse(user.id, houseId);
  return prisma.user.update({
    where: { id: user.id },
    data: { role: 'CHAIRMAN', chairmanHouseId: houseId },
    include: userInclude,
  });
}

export async function dismissChairman(maxUserId: bigint): Promise<DbUser> {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (!existing || existing.role !== 'CHAIRMAN') throw errors.notFound('Председатель ТСЖ с таким ID не найден');
  return await prisma.user.update({
    where: { id: existing.id },
    data: { role: 'RESIDENT', chairmanHouseId: null },
    include: userInclude,
  });
}

const residentRoles: Prisma.UserWhereInput = { role: { in: ['RESIDENT', 'CHAIRMAN'] } };

export async function countResidents(houseId: number): Promise<number> {
  return await prisma.userHouse.count({ where: { houseId, user: residentRoles } });
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

export async function listResidentsOfHouse(houseId: number): Promise<ResidentRow[]> {
  const rows = await prisma.userHouse.findMany({
    where: { houseId, user: residentRoles },
    include: {
      user: {
        select: {
          id: true,
          maxUserId: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
          chairmanHouseId: true,
        },
      },
    },
  });
  const residents: ResidentRow[] = rows.map((row) => ({
    id: row.user.id,
    maxUserId: row.user.maxUserId,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    username: row.user.username,
    apartment: row.apartment,
    verifiedFullName: row.verifiedFullName,
    residentType: row.residentType,
    role:
      row.user.role === 'CHAIRMAN' && row.user.chairmanHouseId === houseId
        ? 'CHAIRMAN'
        : row.user.role === 'UK_EMPLOYEE'
          ? 'UK_EMPLOYEE'
          : 'RESIDENT',
  }));
  return residents.sort((a, b) => (parseInt(a.apartment ?? '', 10) || 0) - (parseInt(b.apartment ?? '', 10) || 0));
}

export async function listEmployees(): Promise<DbUser[]> {
  return await prisma.user.findMany({ where: { role: 'UK_EMPLOYEE' }, include: userInclude, orderBy: { id: 'asc' } });
}

export async function listHouses(companyId?: number | null) {
  return prisma.house.findMany({
    where: companyId != null ? { companyId } : undefined,
    orderBy: { id: 'asc' },
    include: { _count: { select: { residents: true } } },
  });
}

export async function getHouse(id: number) {
  return await prisma.house.findUnique({ where: { id } });
}

export async function setVotePercent(houseId: number, percent: number) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw errors.badRequest('Процент должен быть целым числом от 0 до 100');
  }
  const house = await prisma.house.findUnique({ where: { id: houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  return await prisma.house.update({ where: { id: houseId }, data: { votePercent: percent } });
}

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

export async function findOrCreateHouseAt(lat: number, lng: number, forCompanyId?: number) {
  const { building, house } = await lookupHouseAt(lat, lng);

  if (house) {
    if (forCompanyId !== undefined && house.companyId !== forCompanyId) {
      throw errors.conflict('Этот дом уже закреплён за другой УК', 'other_company_house');
    }
    const filled = house.externalId ? house : await prisma.house.update({ where: { id: house.id }, data: geoFieldsOf(building) });
    return { house: filled, building, created: false };
  }

  const companyId = forCompanyId ?? (await defaultCompanyId());
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
  return await prisma.house.update({ where: { id: houseId }, data: { chatId, chatTitle } });
}

export async function unbindHouseChat(chatId: bigint) {
  await prisma.house.updateMany({ where: { chatId }, data: { chatId: null, chatTitle: null } });
}

export async function getCompany() {
  return await prisma.managementCompany.findFirst({ orderBy: { id: 'asc' } });
}

export async function getCompanyByIdForUser(user: Pick<DbUser, 'role' | 'companyId'>) {
  if (isEmployee(user) && user.companyId != null) {
    return prisma.managementCompany.findUnique({ where: { id: user.companyId } });
  }
  return getCompany();
}

export async function listOrganizations() {
  return await prisma.responsibleOrganization.findMany({ orderBy: { id: 'asc' } });
}
