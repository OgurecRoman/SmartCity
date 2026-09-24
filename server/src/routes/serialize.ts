import { CATEGORY_LABELS, PRIORITY_LABELS, RESIDENT_TYPE_LABELS, ROLE_LABELS, STATUS_LABELS, fullName } from '../lib/labels.js';
import { photoUrlPath } from '../lib/photoStorage.js';
import type { AnnouncementWithRelations } from '../services/announcements.js';
import type { CameraWithHouse } from '../services/cameras.js';
import type { MembershipRequestWithRelations } from '../services/membership.js';
import type { NewsWithRelations } from '../services/news.js';
import type { RequestDetailed, RequestWithRelations } from '../services/requests.js';
import { checkApartment, type Entrance } from '../services/rules.js';
import { apartmentDataOf, type DbUser, type ResidentRow } from '../services/users.js';

function photoUrlsOf(photos: { filename: string }[]): string[] {
  return photos.map((photo) => photoUrlPath(photo.filename));
}

type HouseRow = {
  id: number;
  address: string;
  lat: number | null;
  lng: number | null;
  apartmentsCount: number | null;
  entrances: unknown;
  votePercent: number;
  dataSource: string | null;
  chatId: bigint | null;
};

export function serializeHouse(house: HouseRow, extra: { residentsCount?: number } = {}) {
  return {
    id: house.id,
    address: house.address,
    lat: house.lat,
    lng: house.lng,
    apartmentsCount: house.apartmentsCount,
    entrances: (Array.isArray(house.entrances) ? house.entrances : []) as Entrance[],
    votePercent: house.votePercent,
    dataSource: house.dataSource,
    chatBound: house.chatId !== null,
    residentsCount: extra.residentsCount,
  };
}

export function serializeUser(user: DbUser) {
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
    verifiedFullName: user.verifiedFullName,
    onboarded: user.houseId !== null && user.onboardedAt !== null,
    createdAt: user.createdAt,
  };
}

export function serializeMembershipRequest(request: MembershipRequestWithRelations) {
  return {
    id: request.id,
    houseId: request.houseId,
    houseAddress: request.house.address,
    apartment: request.apartment,
    fullName: request.fullName,
    status: request.status,
    rejectReason: request.rejectReason,
    applicant: { id: request.applicant.id, maxUserId: request.applicant.maxUserId.toString(), name: fullName(request.applicant) },
    reviewedBy: request.reviewedBy ? { id: request.reviewedBy.id, name: fullName(request.reviewedBy) } : null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function entranceOf(user: DbUser): string | null {
  if (!user.house || !user.apartment) return null;
  const check = checkApartment(user.apartment, apartmentDataOf(user.house));
  return check.ok ? check.entrance : null;
}

export function serializeRequest(request: RequestWithRelations, extra: { hasVoted?: boolean; viewerId?: number } = {}) {
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
    resolutionNote: request.resolutionNote,
    resolvedByName: request.resolvedByName,
    delegatedAt: request.delegatedAt,
    delegatedTo: request.delegatedTo,
    house: { id: request.house.id, address: request.house.address },
    author: { id: request.author.id, name: fullName(request.author), apartment: request.author.apartment },
    photoUrls: photoUrlsOf(request.photos.filter((p) => !p.isResult)),
    resultPhotoUrls: photoUrlsOf(request.photos.filter((p) => p.isResult)),
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

export function serializeRequestDetailed(request: RequestDetailed, extra: { hasVoted?: boolean; viewerId?: number } = {}) {
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

export function serializeAnnouncement(announcement: AnnouncementWithRelations) {
  return {
    id: announcement.id,
    houseId: announcement.houseId,
    houseAddress: announcement.house.address,
    title: announcement.title,
    description: announcement.description,
    author: { id: announcement.author.id, name: fullName(announcement.author), role: announcement.author.role },
    photoUrls: photoUrlsOf(announcement.photos),
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

export function serializeNews(news: NewsWithRelations, extra: { viewerId?: number } = {}) {
  return {
    id: news.id,
    houseId: news.houseId,
    houseAddress: news.house.address,
    title: news.title,
    description: news.description,
    contact: news.contact,
    author: { id: news.author.id, name: fullName(news.author), role: news.author.role },
    photoUrls: photoUrlsOf(news.photos),
    isMine: extra.viewerId !== undefined ? news.authorId === extra.viewerId : undefined,
    createdAt: news.createdAt,
    updatedAt: news.updatedAt,
  };
}

export function serializeResident(user: ResidentRow) {
  return {
    id: user.id,
    maxUserId: user.maxUserId.toString(),
    username: user.username,
    apartment: user.apartment,
    fullName: user.verifiedFullName ?? fullName(user),
    verified: user.verifiedFullName !== null,
    role: user.role,
    residentType: user.residentType,
    residentTypeLabel: user.residentType ? RESIDENT_TYPE_LABELS[user.residentType] : null,
  };
}

export function serializeCamera(camera: CameraWithHouse) {
  return {
    id: camera.id,
    houseId: camera.houseId,
    houseAddress: camera.house.address,
    label: camera.label,
    streamUrl: camera.streamUrl,
  };
}
