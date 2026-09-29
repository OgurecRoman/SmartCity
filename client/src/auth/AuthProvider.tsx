import { createContext, useContext, type ReactNode } from 'react';
import { Spinner, Typography, Button } from '@maxhub/max-ui';
import { useMe } from '../hooks/useMe';
import { useDictionaries } from '../hooks/useDictionaries';
import Onboarding from '../pages/Onboarding';
import type { User } from '../types/user';
import s from './AuthProvider.module.scss';

type AuthContextValue = {
  user: User;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError, error, refetch, isFetching } = useMe();
  useDictionaries();

  if (isLoading) {
    return (
      <div className={s.state}>
        <Spinner size={48} appearance="themed" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className={s.state}>
        <Typography.Headline variant="small">Не удалось загрузить профиль</Typography.Headline>
        <Typography.Body variant="medium">
          {(error as Error | null)?.message ?? 'Проверьте, что вы заходите через MAX'}
        </Typography.Body>
        <Button size="small" loading={isFetching} onClick={() => refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  if (!user.onboarded && user.role !== 'UK_EMPLOYEE') {
    return (
      <Onboarding
        user={user}
        refetch={() => void refetch()}
        isFetching={isFetching}
      />
    );
  }

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth должен вызываться внутри AuthProvider');
  }
  return ctx;
}
