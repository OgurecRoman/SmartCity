// Формы ответов бэкенда (/api/bot/*). Это те же объекты, что возвращают сервисы сервера,
// но после JSON: BigInt приходит строкой, даты — строкой ISO.

export type UserRole = 'RESIDENT' | 'UK_EMPLOYEE' | 'CHAIRMAN';
export type ResidentType = 'OWNER' | 'TENANT';
export type RequestCategory = 'NOISE' | 'ELEVATOR' | 'PLUMBING' | 'ELECTRICITY' | 'REPAIR' | 'CLEANING' | 'SECURITY' | 'OTHER';
export type RequestPriority = 'NORMAL' | 'EMERGENCY';
export type RequestStatus = 'VOTING' | 'SUBMITTED' | 'IN_PROGRESS' | 'DELEGATED' | 'RESOLVED' | 'REJECTED' | 'EXPIRED';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type IsoDate = string;

export interface House {
  id: number;
  address: string;
  lat: number | null;
  lng: number | null;
  apartmentsCount: number | null;
  entrances: unknown;
  externalId: string | null;
  dataSource: string | null;
  votePercent: number;
  chatId: string | null;
  chatTitle: string | null;
  companyId: number;
  createdAt: IsoDate;
}

export interface HouseWithCount extends House {
  _count: { residents: number };
}

export interface Company {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  workingHours: string | null;
  createdAt: IsoDate;
}

export interface Organization {
  id: number;
  companyId: number;
  name: string;
  email: string | null;
  phone: string | null;
  categories: RequestCategory[];
}

export interface DbUser {
  id: number;
  maxUserId: string;
  role: UserRole;
  firstName: string;
  lastName: string | null;
  username: string | null;
  houseId: number | null;
  apartment: string | null;
  residentType: ResidentType | null;
  verifiedFullName: string | null;
  companyId: number | null;
  onboardedAt: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  house: House | null;
  company: Company | null;
}

export interface ResidentRow {
  id: number;
  maxUserId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  apartment: string | null;
  verifiedFullName: string | null;
  role: UserRole;
  residentType: ResidentType | null;
}

export interface RequestWithRelations {
  id: number;
  houseId: number;
  authorId: number;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  votesCount: number;
  votesRequired: number;
  deadline: IsoDate | null;
  submittedAt: IsoDate | null;
  resolvedAt: IsoDate | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
  reopenedAt: IsoDate | null;
  rating: number | null;
  ratedAt: IsoDate | null;
  delegatedToId: number | null;
  delegatedAt: IsoDate | null;
  chatMessageId: string | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  author: { id: number; firstName: string; lastName: string | null; apartment: string | null; maxUserId: string };
  house: { id: number; address: string; chatId: string | null; votePercent: number };
  delegatedTo: { id: number; name: string; email: string | null; phone: string | null } | null;
  photos: Array<{ filename: string; isResult: boolean }>;
}

export interface AnnouncementWithRelations {
  id: number;
  houseId: number;
  authorId: number;
  title: string;
  description: string;
  chatMessageId: string | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  author: { id: number; firstName: string; lastName: string | null; role: UserRole };
  house: { id: number; address: string; chatId: string | null };
  photos: Array<{ filename: string }>;
}

export interface NewsWithRelations extends AnnouncementWithRelations {
  contact: string;
}

export interface MembershipRequestWithRelations {
  id: number;
  applicantId: number;
  houseId: number;
  apartment: string;
  fullName: string;
  status: MembershipStatus;
  reviewedById: number | null;
  rejectReason: string | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  applicant: { id: number; maxUserId: string; firstName: string; lastName: string | null };
  house: { id: number; address: string };
  reviewedBy: { id: number; firstName: string; lastName: string | null } | null;
}

export interface GeneratedDocument {
  fileName: string;
  content: string;
}

export interface MailResult {
  simulated: boolean;
  to: string | null;
}

export interface OutboxRow {
  id: number;
  event: string;
  payload: unknown;
  createdAt: IsoDate;
}
