import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from '../lib/queryKeys';
import type { User } from '../types/user';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const { data } = await api.get<User>('/me');
      return data;
    },
  });
}
