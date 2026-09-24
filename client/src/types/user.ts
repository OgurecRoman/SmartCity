export type UserRole = 'RESIDENT' | 'UK_EMPLOYEE';
export type ResidentType = 'OWNER' | 'TENANT';

export type User = {
  id: number;
  maxUserId: string;
  role: UserRole;
  roleLabel: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  name: string;
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
  onboarded: boolean;
  createdAt: string;
};
