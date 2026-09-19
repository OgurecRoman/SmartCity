import { CATEGORY_LABELS, PRIORITY_LABELS, RESIDENT_TYPE_LABELS, ROLE_LABELS, STATUS_LABELS, fullName } from '../lib/labels.js';

import { checkApartment } from '../services/rules.js';
import { apartmentDataOf } from '../services/users.js';

export function serializeHouse(house, extra = {}) {
  return {
    id: house.id,
    address: house.address,
    lat: house.lat,
    lng: house.lng,
    apartmentsCount: house.apartmentsCount,
    entrances: Array.isArray(house.entrances) ? house.entrances : [],
    votePercent: house.votePercent,
    dataSource: house.dataSource,
    chatBound: house.chatId !== null,
    residentsCount: extra.residentsCount,
  };
}

export function serializeUser(user) {
  return {
    id: user.id,
    maxUserId: user.maxUserId.toString(),
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    name: fullName(user),
    house: user.house
      ? {
          id: user.house.id,
          address: user.house.address,
          votePercent: user.house.votePercent,
          lat: user.house.lat,
          lng: user.house.lng,
          apartmentsCount: user.house.apartmentsCount,
        }
      : null,
    apartment: user.apartment,
    entrance: entranceOf(user),
    residentType: user.residentType,
    residentTypeLabel: user.residentType ? RESIDENT_TYPE_LABELS[user.residentType] : null,
    onboarded: user.houseId !== null && user.onboardedAt !== null,
    createdAt: user.createdAt,
  };
}

/** Номер подъезда по квартире, если у дома известны диапазоны квартир по подъездам */
function entranceOf(user) {
  if (!user.house || !user.apartment) return null;
  const check = checkApartment(user.apartment, apartmentDataOf(user.house));
  return check.ok ? check.entrance : null;
}

export function serializeRequest(request, extra = {}) {
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    category: request.category,
    categoryLabel: CATEGORY_LABELS[request.category],
    priority: request.priority,
    priorityLabel: PRIORITY_LABELS[request.priority],
    status: request.status,
    statusLabel: STATUS_LABELS[request.status],
    votesCount: request.votesCount,
    votesRequired: request.votesRequired,
    deadline: request.deadline,
    submittedAt: request.submittedAt,
    resolvedAt: request.resolvedAt,
    delegatedAt: request.delegatedAt,
    delegatedTo: request.delegatedTo,
    house: { id: request.house.id, address: request.house.address },
    author: { id: request.author.id, name: fullName(request.author), apartment: request.author.apartment },
    isMine: extra.viewerId !== undefined ? request.authorId === extra.viewerId : undefined,
    hasVoted: extra.hasVoted,
    canVote:
      extra.viewerId !== undefined
        ? request.status === 'VOTING' && request.authorId !== extra.viewerId && extra.hasVoted !== true
        : undefined,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export function serializeRequestDetailed(request, extra = {}) {
  return {
    ...serializeRequest(request, extra),
    votes: request.votes.map((vote) => ({
      id: vote.id,
      createdAt: vote.createdAt,
      user: { id: vote.user.id, name: fullName(vote.user), apartment: vote.user.apartment },
    })),
    statusHistory: request.statusHistory.map((entry) => ({
      id: entry.id,
      oldStatus: entry.oldStatus,
      oldStatusLabel: entry.oldStatus ? STATUS_LABELS[entry.oldStatus] : null,
      newStatus: entry.newStatus,
      newStatusLabel: STATUS_LABELS[entry.newStatus],
      comment: entry.comment,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy ? { id: entry.changedBy.id, name: fullName(entry.changedBy), role: entry.changedBy.role } : null,
    })),
  };
}
