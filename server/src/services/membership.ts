import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { errors } from '../lib/errors.js';
import { events } from '../lib/events.js';
import { apartmentDataOf, canActOnHouse, type DbUser } from './users.js';
import { checkApartment } from './rules.js';

export const membershipRequestInclude = {
  applicant: { select: { id: true, maxUserId: true, firstName: true, lastName: true } },
  house: { select: { id: true, address: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MembershipRequestInclude;

export type MembershipRequestWithRelations = Prisma.MembershipRequestGetPayload<{ include: typeof membershipRequestInclude }>;

export interface SubmitMembershipInput {
  applicantId: number;
  houseId: number;
  apartment: string;
  fullName: string;
}

export async function submitMembershipRequest(input: SubmitMembershipInput): Promise<MembershipRequestWithRelations> {
  const house = await prisma.house.findUnique({ where: { id: input.houseId } });
  if (!house) throw errors.notFound('Дом не найден');

  const apartment = input.apartment.trim();
  if (!apartment || apartment.length > 10) throw errors.badRequest('Укажите номер квартиры (до 10 символов)');
  const check = checkApartment(apartment, apartmentDataOf(house));
  if (!check.ok) throw errors.badRequest(check.message, 'apartment_not_found');

  const fullName = input.fullName.trim();
  if (fullName.length < 3 || fullName.length > 150) throw errors.badRequest('Укажите ФИО (от 3 до 150 символов)');

  const pending = await prisma.membershipRequest.findFirst({
    where: { applicantId: input.applicantId, status: 'PENDING' },
  });
  if (pending) throw errors.conflict('У вас уже есть заявка на рассмотрении', 'membership_pending');

  const request = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.applicantId },
      data: { houseId: house.id, apartment, residentType: 'OWNER', onboardedAt: null },
    });
    return tx.membershipRequest.create({
      data: { applicantId: input.applicantId, houseId: house.id, apartment, fullName, status: 'PENDING' },
      include: membershipRequestInclude,
    });
  });

  events.emit('membership.requested', { requestId: request.id });
  return request;
}

export async function getMembershipRequest(id: number): Promise<MembershipRequestWithRelations | null> {
  return prisma.membershipRequest.findUnique({ where: { id }, include: membershipRequestInclude });
}

export async function getLatestMembershipRequestFor(applicantId: number): Promise<MembershipRequestWithRelations | null> {
  return prisma.membershipRequest.findFirst({
    where: { applicantId },
    include: membershipRequestInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPendingMembershipRequests(reviewer: Pick<DbUser, 'role' | 'houseId'>): Promise<MembershipRequestWithRelations[]> {
  const where: Prisma.MembershipRequestWhereInput = { status: 'PENDING' };
  if (reviewer.role === 'CHAIRMAN') where.houseId = reviewer.houseId ?? -1;
  return prisma.membershipRequest.findMany({ where, include: membershipRequestInclude, orderBy: { createdAt: 'asc' } });
}

export async function approveMembershipRequest(id: number, reviewer: DbUser): Promise<MembershipRequestWithRelations> {
  const request = await prisma.membershipRequest.findUnique({ where: { id } });
  if (!request) throw errors.notFound('Заявка не найдена');
  if (request.status !== 'PENDING') throw errors.conflict('Заявка уже рассмотрена');
  if (!canActOnHouse(reviewer, request.houseId)) throw errors.forbidden('Подтвердить заявку может председатель ТСЖ этого дома или сотрудник УК');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: request.applicantId },
      data: { onboardedAt: new Date(), verifiedFullName: request.fullName },
    });
    return tx.membershipRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: reviewer.id },
      include: membershipRequestInclude,
    });
  });

  events.emit('membership.approved', { requestId: id });
  return updated;
}

export async function rejectMembershipRequest(id: number, reviewer: DbUser, reason: string): Promise<MembershipRequestWithRelations> {
  const request = await prisma.membershipRequest.findUnique({ where: { id } });
  if (!request) throw errors.notFound('Заявка не найдена');
  if (request.status !== 'PENDING') throw errors.conflict('Заявка уже рассмотрена');
  if (!canActOnHouse(reviewer, request.houseId)) throw errors.forbidden('Отклонить заявку может председатель ТСЖ этого дома или сотрудник УК');

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) throw errors.badRequest('Укажите причину отказа (от 3 символов)');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: request.applicantId },
      data: { houseId: null, apartment: null, residentType: null },
    });
    return tx.membershipRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: reviewer.id, rejectReason: trimmedReason },
      include: membershipRequestInclude,
    });
  });

  events.emit('membership.rejected', { requestId: id });
  return updated;
}
