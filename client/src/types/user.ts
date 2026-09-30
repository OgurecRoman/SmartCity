export type UserRole = 'RESIDENT' | 'UK_EMPLOYEE' | 'CHAIRMAN';
export type ResidentType = 'OWNER' | 'TENANT';
export type MembershipStatus = 'PENDING' | 'REJECTED';

export type Membership = {
  id: number;
  houseId: number;
  houseAddress: string;
  apartment: string;
  fullName: string;
  status: MembershipStatus;
  rejectReason: string | null;
  createdAt: string;
};

export type UserHouseItem = {
  houseId: number;
  address: string;
  apartment: string | null;
  residentType: ResidentType | null;
  residentTypeLabel: string | null;
  status: 'APPROVED' | 'PENDING';
  active: boolean;
  membershipRequestId: number | null;
};

export type User = {
  id: number;
  maxUserId: string;
  role: UserRole;
  roleLabel: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  name: string;
  companyId: number | null;
  chairmanHouseId: number | null;
  house: {
    id: number;
    address: string;
    votePercent: number;
    lat: number | null;
    lng: number | null;
    apartmentsCount: number | null;
  } | null;
  apartment: string | null;
  entrance: string | null;
  residentType: ResidentType | null;
  residentTypeLabel: string | null;
  verifiedFullName: string | null;
  onboarded: boolean;
  membership: Membership | null;
  houses?: UserHouseItem[];
  createdAt: string;
};
