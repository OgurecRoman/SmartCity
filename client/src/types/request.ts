export type RequestStatus =
  | 'VOTING'
  | 'SUBMITTED'
  | 'IN_PROGRESS'
  | 'DELEGATED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'EXPIRED';

export type RequestPriority = 'NORMAL' | 'EMERGENCY';

export type RequestCategory =
  | 'NOISE'
  | 'ELEVATOR'
  | 'PLUMBING'
  | 'ELECTRICITY'
  | 'REPAIR'
  | 'CLEANING'
  | 'SECURITY'
  | 'OTHER';

export type RequestType = {
  id: number;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  priority: string;
  priorityLabel: string;
  status: string;
  statusLabel: string;
  votesCount: number;
  votesRequired: number;
  deadline: string | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
  reopenedAt: string | null;
  rating: number | null;
  delegatedAt: string | null;
  delegatedTo: { id: number; name: string; email: string | null; phone: string | null } | null;
  house: { id: number; address: string } | null;
  author: { id: number; name: string; apartment: string | null } | null;
  isMine: boolean;
  hasVoted: boolean;
  canVote: boolean;
  photoUrls: string[];
  resultPhotoUrls: string[];
  createdAt: string;
  updatedAt: string;
};

export type RequestVote = {
  id: number;
  createdAt: string;
  user: { id: number; name: string; apartment: string | null };
};

export type RequestStatusHistory = {
  id: number;
  oldStatus: string | null;
  oldStatusLabel: string | null;
  newStatus: string;
  newStatusLabel: string;
  comment: string | null;
  changedAt: string;
  changedBy: { id: number; name: string; role: string } | null;
};

export type RequestDetailed = RequestType & {
  votes: RequestVote[];
  statusHistory: RequestStatusHistory[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
};
