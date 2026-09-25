export type DbUser = {
  id: number;
  maxUserId: bigint;
  role: "RESIDENT" | "UK_EMPLOYEE" | "CHAIRMAN";
  firstName: string;
  lastName: string | null;
  username: string | null;
  houseId: number | null;
  apartment: string | null;
  residentType: "OWNER" | "TENANT";
  verifiedFullName: string | null;
  companyId: number | null;
  onboarded: Date | null;
  createdAt: Date;
  updatedAt: Date;

  house: {
    id: number;
    companyId: number;
    createdAt: Date;
    address: string;
    lat: number | null;
    lng: number | null;
    apartmentsCount: number | null;
    entrances: JSON;
    externalId: string | null;
    dataSource: string | null;
    votePercent: number;
    chatId: bigint | null;
    chatTitle: string | null;
  } | null;

  company: {
    name: string;
    id: number;
    createdAt: Date;
    phone: string;
    email: string | null;
    address: string | null;
    workingHours: string | null;
  } | null;
}