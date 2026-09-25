import type {
  AnnouncementWithRelations,
  Company,
  DbUser,
  GeneratedDocument,
  House,
  HouseWithCount,
  MailResult,
  MembershipRequestWithRelations,
  NewsWithRelations,
  Organization,
  OutboxRow,
  RequestCategory,
  RequestPriority,
  RequestStatus,
  RequestWithRelations,
  ResidentRow,
} from '../types/index.js';
import { download, request, upload } from './network.js';

// Типизированные обёртки над ручками /api/bot/*. Имена повторяют бывшие сервисные функции сервера,
// чтобы код хендлеров и сценариев менялся минимально.

type Id = number | string | bigint;
const s = (value: Id) => String(value);

// --- Пользователи ---

export interface MaxIdentity {
  maxUserId: Id;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
}

export async function upsertFromMax(identity: MaxIdentity): Promise<DbUser> {
  const { user } = await request<{ user: DbUser }>('POST', 'bot/user/upsert', { ...identity, maxUserId: s(identity.maxUserId) });
  return user;
}

export const getUserById = (id: number) => request<DbUser | null>('GET', `bot/users/${id}`);
export const getUserByMaxId = (maxUserId: Id) => request<DbUser | null>('GET', `bot/users/by-max/${s(maxUserId)}`);
export const listEmployees = () => request<DbUser[]>('GET', 'bot/users/employees');
export const getChairmanOf = (houseId: number) => request<DbUser | null>('GET', `bot/houses/${houseId}/chairman`);
export const promoteToEmployee = (userId: number, code: string) => request<DbUser>('POST', 'bot/users/promote', { userId, code });
export const assignResidentToHouse = (maxUserId: Id, houseId: number) =>
  request<DbUser>('POST', 'bot/users/assign-house', { maxUserId: s(maxUserId), houseId });
export const detachResident = (maxUserId: Id) => request<DbUser>('POST', 'bot/users/detach', { maxUserId: s(maxUserId) });
export const appointChairman = (maxUserId: Id, houseId: number) =>
  request<DbUser>('POST', 'bot/users/appoint-chairman', { maxUserId: s(maxUserId), houseId });
export const dismissChairman = (maxUserId: Id) => request<DbUser>('POST', 'bot/users/dismiss-chairman', { maxUserId: s(maxUserId) });
export const addTenantByOwner = (ownerId: number, maxUserId: Id, apartment: string) =>
  request<DbUser>('POST', 'bot/users/add-tenant', { ownerId, maxUserId: s(maxUserId), apartment });

// --- Дома, компания, организации ---

export const listHouses = () => request<HouseWithCount[]>('GET', 'bot/houses');
export const getHouse = (id: number) => request<House | null>('GET', `bot/houses/${id}`);
export const listResidentsOfHouse = (houseId: number) => request<ResidentRow[]>('GET', `bot/houses/${houseId}/residents`);
export const computeVotesRequired = async (houseId: number) =>
  (await request<{ votesRequired: number }>('GET', `bot/houses/${houseId}/votes-required`)).votesRequired;
export const getHouseByChat = (chatId: Id) => request<House | null>('GET', `bot/houses/by-chat/${s(chatId)}`);
export const bindHouseChat = (houseId: number, chatId: Id, chatTitle: string | null) =>
  request<House>('POST', `bot/houses/${houseId}/chat`, { chatId: s(chatId), chatTitle });
export const unbindHouseChat = (chatId: Id) => request<void>('POST', 'bot/houses/unbind-chat', { chatId: s(chatId) });
export const getCompany = () => request<Company | null>('GET', 'bot/company');
export const listOrganizations = () => request<Organization[]>('GET', 'bot/organizations');

// --- Заявки ---

export interface ListRequestsFilter {
  authorId?: number;
  supportedByUserId?: number;
  statuses?: readonly RequestStatus[];
  limit?: number;
}

export const listRequests = (filter: ListRequestsFilter) =>
  request<RequestWithRelations[]>('GET', 'bot/requests', undefined, { ...filter, statuses: filter.statuses?.join(',') });
export const getRequest = (id: number) => request<RequestWithRelations | null>('GET', `bot/requests/${id}`);
export const getRequestDocument = (id: number) => request<GeneratedDocument>('GET', `bot/requests/${id}/document`);
export const hasVoted = async (requestId: number, userId: number) =>
  (await request<{ voted: boolean }>('GET', `bot/requests/${requestId}/voted`, undefined, { userId })).voted;
export const voterMaxIds = async (requestId: number, excludeUserId?: number) => {
  const { votes } = await request<{ votes: Array<{ user: { maxUserId: string } }> }>('GET', 'bot/votes', undefined, { requestId, excludeUserId });
  return votes.map((vote) => vote.user.maxUserId);
};

export interface CreateRequestInput {
  authorId: number;
  category: RequestCategory;
  description: string;
  priority?: RequestPriority;
  deadline?: Date | null;
  photos?: string[];
}

export const createRequest = (input: CreateRequestInput) =>
  request<RequestWithRelations>('POST', 'bot/requests', { ...input, deadline: input.deadline ? input.deadline.toISOString() : null });
export const vote = (requestId: number, userId: number) =>
  request<{ request: RequestWithRelations; submitted: boolean }>('POST', `bot/requests/${requestId}/vote`, { userId });
export const deleteRequest = (requestId: number, userId: number) => request<void>('POST', `bot/requests/${requestId}/delete`, { userId });

export interface ChangeStatusInput {
  byUserId: number;
  comment?: string | null;
  organizationId?: number;
  resolutionNote?: string;
  resolvedByName?: string;
  photos?: string[];
}

export const changeStatus = (requestId: number, status: RequestStatus, input: ChangeStatusInput) =>
  request<{ request: RequestWithRelations; mail: MailResult | null }>('POST', `bot/requests/${requestId}/status`, { ...input, status });
export const reopenRequest = (requestId: number, input: { userId: number; reason: string; photos: string[] }) =>
  request<RequestWithRelations>('POST', `bot/requests/${requestId}/reopen`, input);
export const setRequestChatMessage = (requestId: number, messageId: string) =>
  request<void>('POST', `bot/requests/${requestId}/chat-message`, { messageId });

// --- Заявки на вступление ---

export const getMembershipRequest = (id: number) => request<MembershipRequestWithRelations | null>('GET', `bot/membership/${id}`);
export const getLatestMembershipRequestFor = (applicantId: number) =>
  request<MembershipRequestWithRelations | null>('GET', 'bot/membership/latest', undefined, { applicantId });
export const listPendingMembershipRequests = (reviewerId: number) =>
  request<MembershipRequestWithRelations[]>('GET', 'bot/membership/pending', undefined, { reviewerId });
export const submitMembershipRequest = (input: { applicantId: number; houseId: number; apartment: string; fullName: string }) =>
  request<MembershipRequestWithRelations>('POST', 'bot/membership', input);
export const approveMembershipRequest = (id: number, reviewerId: number) =>
  request<MembershipRequestWithRelations>('POST', `bot/membership/${id}/approve`, { reviewerId });
export const rejectMembershipRequest = (id: number, reviewerId: number, reason: string) =>
  request<MembershipRequestWithRelations>('POST', `bot/membership/${id}/reject`, { reviewerId, reason });

// --- Объявления и новости ---

export interface CreateAnnouncementInput {
  houseId: number;
  authorId: number;
  title: string;
  description: string;
  photos?: string[];
}

export const createAnnouncement = (input: CreateAnnouncementInput) => request<AnnouncementWithRelations>('POST', 'bot/announcements', input);
export const getAnnouncement = (id: number) => request<AnnouncementWithRelations | null>('GET', `bot/announcements/${id}`);
export const setAnnouncementChatMessage = (id: number, messageId: string) =>
  request<void>('POST', `bot/announcements/${id}/chat-message`, { messageId });
export const createNews = (input: CreateAnnouncementInput & { contact: string }) => request<NewsWithRelations>('POST', 'bot/news', input);
export const getNews = (id: number) => request<NewsWithRelations | null>('GET', `bot/news/${id}`);
export const setNewsChatMessage = (id: number, messageId: string) => request<void>('POST', `bot/news/${id}/chat-message`, { messageId });

// --- Фото ---

export const uploadPhoto = async (buffer: Buffer, ext: string) =>
  (await upload<{ filename: string }>('bot/photos', buffer, `photo${ext}`)).filename;
export const downloadPhoto = (filename: string) => download(`/uploads/photos/${encodeURIComponent(filename)}`);

// --- Сессии сценариев и очередь уведомлений ---

export const getSession = <T>(key: string) => request<T | null>('GET', `bot/session/${encodeURIComponent(key)}`);
export const setSession = (key: string, value: unknown) => request<void>('PUT', `bot/session/${encodeURIComponent(key)}`, value);
export const deleteSession = (key: string) => request<void>('DELETE', `bot/session/${encodeURIComponent(key)}`);
export const listOutbox = (limit = 50) => request<OutboxRow[]>('GET', 'bot/outbox', undefined, { limit });
export const ackOutbox = (id: number) => request<void>('DELETE', `bot/outbox/${id}`);
