import { config } from '../config.js';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';

import { findBuildingAt } from './geo.js';
import { checkApartment } from './rules.js';

export const userInclude = { house: true, company: true };

async function defaultCompanyId() {
  const company = await prisma.managementCompany.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  return company?.id ?? null;
}

/** Находит пользователя по MAX id или создаёт его; обновляет имя и права из UK_ADMIN_IDS. */
export async function upsertFromMax(identity) {
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

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id }, include: userInclude });
}

export async function getUserByMaxId(maxUserId) {
  return prisma.user.findUnique({ where: { maxUserId }, include: userInclude });
}

export function isEmployee(user) {
  return user.role === 'UK_EMPLOYEE';
}

export function isOnboarded(user) {
  return user.houseId !== null && user.onboardedAt !== null;
}

export async function completeOnboarding(userId, input) {
  const house = await prisma.house.findUnique({ where: { id: input.houseId } });
  if (!house) throw errors.notFound('Дом не найден');
  const apartment = input.apartment.trim();
  if (!apartment || apartment.length > 10) throw errors.badRequest('Укажите номер квартиры (до 10 символов)');
  const check = checkApartment(apartment, apartmentDataOf(house));
  if (!check.ok) throw errors.badRequest(check.message, 'apartment_not_found');
  return prisma.user.update({
    where: { id: userId },
    data: { houseId: house.id, apartment, residentType: input.residentType, onboardedAt: new Date() },
    include: userInclude,
  });
}

export async function promoteToEmployee(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { role: 'UK_EMPLOYEE', companyId: await defaultCompanyId() },
    include: userInclude,
  });
}

/** Сотрудник УК вручную добавляет жителя (владельца) в дом по его MAX id. */
export async function assignResidentToHouse(maxUserId, houseId) {
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

/** Сотрудник УК отвязывает жителя от дома. */
export async function detachResident(maxUserId) {
  const existing = await prisma.user.findUnique({ where: { maxUserId } });
  if (!existing || existing.houseId === null) throw errors.notFound('Житель с таким ID не привязан к дому');
  return prisma.user.update({
    where: { id: existing.id },
    data: { houseId: null, apartment: null, residentType: null, onboardedAt: null },
    include: userInclude,
  });
}

export async function countResidents(houseId) {
  return prisma.user.count({ where: { houseId, role: 'RESIDENT', onboardedAt: { not: null } } });
}

export async function listEmployees() {
  return prisma.user.findMany({ where: { role: 'UK_EMPLOYEE' }, include: userInclude, orderBy: { id: 'asc' } });
}

export async function listHouses() {
  return prisma.house.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { residents: true } } } });
}

export async function getHouse(id) {
  return prisma.house.findUnique({ where: { id } });
}

/** Сведения о квартирах дома для проверки номера (entrances хранится в БД как JSON). */
export function apartmentDataOf(house) {
  return { apartmentsCount: house.apartmentsCount, entrances: Array.isArray(house.entrances) ? house.entrances : null };
}

function geoFieldsOf(building) {
  return {
    lat: building.lat,
    lng: building.lng,
    apartmentsCount: building.apartmentsCount,
    entrances: building.entrances,
    externalId: building.externalId,
    dataSource: building.source,
  };
}

/** Здание с карты → дом в базе (по идентификатору здания или по адресу), если он уже есть. */
export async function lookupHouseAt(lat, lng) {
  const building = await findBuildingAt(lat, lng);
  if (!building) {
    throw errors.notFound('В этой точке не нашли жилой дом с адресом — нажмите точнее на здание', 'building_not_found');
  }
  const house = await prisma.house.findFirst({
    where: { OR: [{ externalId: building.externalId }, { address: { equals: building.address, mode: 'insensitive' } }] },
  });
  return { building, house };
}

/**
 * Житель выбрал дом на карте: возвращаем дом из базы (дополнив его сведениями о здании, если их не было)
 * или создаём новый и привязываем к управляющей компании по умолчанию.
 */
export async function findOrCreateHouseAt(lat, lng) {
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

export async function getHouseByChat(chatId) {
  return prisma.house.findUnique({ where: { chatId } });
}

export async function bindHouseChat(houseId, chatId, chatTitle) {
  // Один чат может быть привязан только к одному дому
  await prisma.house.updateMany({ where: { chatId, NOT: { id: houseId } }, data: { chatId: null, chatTitle: null } });
  return prisma.house.update({ where: { id: houseId }, data: { chatId, chatTitle } });
}

export async function unbindHouseChat(chatId) {
  await prisma.house.updateMany({ where: { chatId }, data: { chatId: null, chatTitle: null } });
}

export async function getCompany() {
  return prisma.managementCompany.findFirst({ orderBy: { id: 'asc' } });
}

export async function listOrganizations() {
  return prisma.responsibleOrganization.findMany({ orderBy: { id: 'asc' } });
}
