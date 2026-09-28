export const queryKeys = {
  me: ['me'] as const,
  dictionaries: ['dictionaries'] as const,
  requests: ['requests'] as const,
  request: (id: number) => ['requests', id] as const,
  houses: ['houses'] as const,
  news: ['news'] as const,
  announcements: ['announcements'] as const,
  membership: ['membership'] as const,
  residents: (houseId: number) => ['residents', houseId] as const,
  company: ['company'] as const,
};
