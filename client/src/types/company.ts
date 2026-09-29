export type Company = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  workingHours: string | null;
  rating?: { average: number | null; count: number } | null;
  metrics?: unknown;
};
