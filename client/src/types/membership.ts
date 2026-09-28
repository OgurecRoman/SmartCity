export type MembershipApplicant = {
  id: number;
  maxUserId: string;
  name: string;
};

export type MembershipRequestItem = {
  id: number;
  houseId: number;
  houseAddress: string;
  apartment: string;
  fullName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason: string | null;
  applicant: MembershipApplicant;
  reviewedBy: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ResidentItem = {
  id: number;
  maxUserId: string;
  username: string | null;
  apartment: string | null;
  fullName: string;
  verified: boolean;
  role: 'RESIDENT' | 'CHAIRMAN' | 'UK_EMPLOYEE';
  residentType: 'OWNER' | 'TENANT' | null;
  residentTypeLabel: string | null;
};
