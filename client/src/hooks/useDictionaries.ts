import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { queryKeys } from '../lib/queryKeys';
import type { Dictionaries } from '../types/dictionaries';

export function useDictionaries() {
  return useQuery({
    queryKey: queryKeys.dictionaries,
    queryFn: async () => {
      const { data } = await api.get<Dictionaries>('/dictionaries');
      return data;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function labelOf(
  items: { value: string; label: string }[] | undefined,
  value: string | null | undefined,
): string {
  if (!value) return '';
  return items?.find((item) => item.value === value)?.label ?? value;
}
