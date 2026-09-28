import { download, request, upload } from './network.js';
const s = (value) => String(value);
export async function upsertFromMax(identity) {
    const { user } = await request('POST', 'bot/user/upsert', { ...identity, maxUserId: s(identity.maxUserId) });
    return user;
}
export const getUserById = (id) => request('GET', `bot/users/${id}`);
export const getUserByMaxId = (maxUserId) => request('GET', `bot/users/by-max/${s(maxUserId)}`);
export const listEmployees = () => request('GET', 'bot/users/employees');
export const getChairmanOf = (houseId) => request('GET', `bot/houses/${houseId}/chairman`);
export const promoteToEmployee = (userId, code) => request('POST', 'bot/users/promote', { userId, code });
export const assignResidentToHouse = (maxUserId, houseId) => request('POST', 'bot/users/assign-house', { maxUserId: s(maxUserId), houseId });
export const detachResident = (maxUserId) => request('POST', 'bot/users/detach', { maxUserId: s(maxUserId) });
export const appointChairman = (maxUserId, houseId) => request('POST', 'bot/users/appoint-chairman', { maxUserId: s(maxUserId), houseId });
export const dismissChairman = (maxUserId) => request('POST', 'bot/users/dismiss-chairman', { maxUserId: s(maxUserId) });
export const addTenantByOwner = (ownerId, maxUserId, apartment) => request('POST', 'bot/users/add-tenant', { ownerId, maxUserId: s(maxUserId), apartment });
// Дома, компания, организации
export const listHouses = () => request('GET', 'bot/houses');
export const getHouse = (id) => request('GET', `bot/houses/${id}`);
export const listResidentsOfHouse = (houseId) => request('GET', `bot/houses/${houseId}/residents`);
export const computeVotesRequired = async (houseId) => (await request('GET', `bot/houses/${houseId}/votes-required`)).votesRequired;
export const getHouseByChat = (chatId) => request('GET', `bot/houses/by-chat/${s(chatId)}`);
export const bindHouseChat = (houseId, chatId, chatTitle) => request('POST', `bot/houses/${houseId}/chat`, { chatId: s(chatId), chatTitle });
export const unbindHouseChat = (chatId) => request('POST', 'bot/houses/unbind-chat', { chatId: s(chatId) });
export const getCompany = () => request('GET', 'bot/company');
export const listOrganizations = () => request('GET', 'bot/organizations');
export const listRequests = (filter) => request('GET', 'bot/requests', undefined, { ...filter, statuses: filter.statuses?.join(',') });
export const getRequest = (id) => request('GET', `bot/requests/${id}`);
export const getRequestDocument = (id) => request('GET', `bot/requests/${id}/document`);
export const hasVoted = async (requestId, userId) => (await request('GET', `bot/requests/${requestId}/voted`, undefined, { userId })).voted;
export const voterMaxIds = async (requestId, excludeUserId) => {
    const { votes } = await request('GET', 'bot/votes', undefined, { requestId, excludeUserId });
    return votes.map((vote) => vote.user.maxUserId);
};
export const createRequest = (input) => request('POST', 'bot/requests', { ...input, deadline: input.deadline ? input.deadline.toISOString() : null });
export const vote = (requestId, userId) => request('POST', `bot/requests/${requestId}/vote`, { userId });
export const deleteRequest = (requestId, userId) => request('POST', `bot/requests/${requestId}/delete`, { userId });
export const changeStatus = (requestId, status, input) => request('POST', `bot/requests/${requestId}/status`, { ...input, status });
export const reopenRequest = (requestId, input) => request('POST', `bot/requests/${requestId}/reopen`, input);
export const setRequestChatMessage = (requestId, messageId) => request('POST', `bot/requests/${requestId}/chat-message`, { messageId });
// Заявки на вступление
export const getMembershipRequest = (id) => request('GET', `bot/membership/${id}`);
export const getLatestMembershipRequestFor = (applicantId) => request('GET', 'bot/membership/latest', undefined, { applicantId });
export const listPendingMembershipRequests = (reviewerId) => request('GET', 'bot/membership/pending', undefined, { reviewerId });
export const submitMembershipRequest = (input) => request('POST', 'bot/membership', input);
export const approveMembershipRequest = (id, reviewerId) => request('POST', `bot/membership/${id}/approve`, { reviewerId });
export const rejectMembershipRequest = (id, reviewerId, reason) => request('POST', `bot/membership/${id}/reject`, { reviewerId, reason });
export const createAnnouncement = (input) => request('POST', 'bot/announcements', input);
export const getAnnouncement = (id) => request('GET', `bot/announcements/${id}`);
export const setAnnouncementChatMessage = (id, messageId) => request('POST', `bot/announcements/${id}/chat-message`, { messageId });
export const createNews = (input) => request('POST', 'bot/news', input);
export const getNews = (id) => request('GET', `bot/news/${id}`);
export const setNewsChatMessage = (id, messageId) => request('POST', `bot/news/${id}/chat-message`, { messageId });
// Фото
export const uploadPhoto = async (buffer, ext) => (await upload('bot/photos', buffer, `photo${ext}`)).filename;
export const downloadPhoto = (filename) => download(`/uploads/photos/${encodeURIComponent(filename)}`);
// Сессии и очередь уведомлений
export const getSession = (key) => request('GET', `bot/session/${encodeURIComponent(key)}`);
export const setSession = (key, value) => request('PUT', `bot/session/${encodeURIComponent(key)}`, value);
export const deleteSession = (key) => request('DELETE', `bot/session/${encodeURIComponent(key)}`);
export const listOutbox = (limit = 50) => request('GET', 'bot/outbox', undefined, { limit });
export const ackOutbox = (id) => request('DELETE', `bot/outbox/${id}`);
//# sourceMappingURL=api.js.map