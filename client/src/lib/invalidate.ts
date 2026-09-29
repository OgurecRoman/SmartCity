import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export function useInvalidateAppQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateRequests: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
        queryClient.invalidateQueries({ queryKey: ['requests'] }),
      ]),
    invalidateMe: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    invalidateNews: () => queryClient.invalidateQueries({ queryKey: queryKeys.news }),
    invalidateAnnouncements: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements }),
    invalidateFeed: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.announcements }),
      ]),
    invalidateMembership: () => queryClient.invalidateQueries({ queryKey: queryKeys.membership }),
    invalidateResidents: (houseId?: number) =>
      houseId != null
        ? queryClient.invalidateQueries({ queryKey: queryKeys.residents(houseId) })
        : queryClient.invalidateQueries({ queryKey: ['residents'] }),
    invalidateHouses: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses }),
    invalidateCompany: () => queryClient.invalidateQueries({ queryKey: queryKeys.company }),
    invalidateAll: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.news }),
        queryClient.invalidateQueries({ queryKey: queryKeys.announcements }),
        queryClient.invalidateQueries({ queryKey: queryKeys.membership }),
        queryClient.invalidateQueries({ queryKey: ['residents'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.houses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.company }),
      ]),
  };
}
