export type StatusRequestType = {
    VOTING: 'Голосование',
    SUBMITTED: 'Отправлено',
    IN_PROGRESS: 'В работе',
    DELEGATED: 'Передана в службу',
    RESOLVED: 'Решено',
    REJECTED: 'Отклонено',
    EXPIRED: 'Истекло',
}
  
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
    delegatedAt: string | null;
    delegatedTo: { id: number; name: string; email: string; phone: string } | null;
    house: { id: number; address: string } | null;
    author: { id: number; name: string; apartment: string } | null;
    isMine: boolean;
    hasVoted: boolean;
    canVote: boolean;
    createdAt: string;
    updatedAt: string;
}