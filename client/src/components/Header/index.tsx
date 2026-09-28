import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Typography } from '@maxhub/max-ui';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import type { User, UserHouseItem } from '../../types/user';
import s from './Header.module.scss';

type Props = {
  onAddHouse?: () => void;
};

function labelOf(item: UserHouseItem) {
  const apt = item.apartment ? `кв. ${item.apartment}` : null;
  return apt ? `${shortAddress(item.address)}, ${apt}` : shortAddress(item.address);
}

function shortAddress(address: string) {
  return address.replace(/\s+улица\b/gi, ' ул.').replace(/\s+улица,/gi, ' ул.,');
}

function housesFromUser(user: User): UserHouseItem[] {
  if (user.houses && user.houses.length > 0) return user.houses;
  if (!user.house) return [];
  return [
    {
      houseId: user.house.id,
      address: user.house.address,
      apartment: user.apartment,
      residentType: user.residentType,
      residentTypeLabel: user.residentTypeLabel,
      status: 'APPROVED',
      active: true,
      membershipRequestId: null,
    },
  ];
}

export default function Header({ onAddHouse }: Props) {
  const { user } = useAuth();
  const { invalidateAll } = useInvalidateAppQueries();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const houses = housesFromUser(user);
  const active = houses.find((h) => h.active && h.status === 'APPROVED') ?? houses.find((h) => h.active);
  const triggerLabel = active
    ? labelOf(active)
    : user.house
      ? labelOf({
          houseId: user.house.id,
          address: user.house.address,
          apartment: user.apartment,
          residentType: user.residentType,
          residentTypeLabel: user.residentTypeLabel,
          status: 'APPROVED',
          active: true,
          membershipRequestId: null,
        })
      : 'Выбрать дом';
  const canManage = user.role === 'RESIDENT' || user.role === 'CHAIRMAN';

  const switchMutation = useMutation({
    mutationFn: async (houseId: number) => {
      const { data } = await api.put<User>('/me/active-house', { houseId });
      return data;
    },
    onSuccess: async () => {
      await invalidateAll();
      setOpen(false);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (houseId: number) => {
      const { data } = await api.delete<User>(`/me/houses/${houseId}`);
      return data;
    },
    onSuccess: async () => {
      await invalidateAll();
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className={s.header}>
      <Typography.Headline variant="small" asChild>
        <h1>Умный город</h1>
      </Typography.Headline>

      <div className={s.menuRoot} ref={rootRef}>
        <button
          type="button"
          className={s.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={s.triggerText} title={triggerLabel}>
            {triggerLabel}
          </span>
          <ChevronDown size={14} strokeWidth={2} className={open ? `${s.chevron} ${s.chevronOpen}` : s.chevron} />
        </button>

        {open && (
          <div className={s.dropdown} role="listbox" aria-label="Квартиры">
            {houses.length === 0 ? (
              <p className={s.empty}>Нет домов</p>
            ) : (
              <ul className={s.list}>
                {houses.map((item) => {
                  const approved = item.status === 'APPROVED';
                  const selected = item.active && approved;
                  const busy = switchMutation.isPending || leaveMutation.isPending;
                  return (
                    <li key={`${item.status}-${item.houseId}`} className={s.row}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={selected ? `${s.item} ${s.itemActive}` : s.item}
                        disabled={!approved || selected || busy}
                        onClick={() => {
                          if (!approved || selected) return;
                          switchMutation.mutate(item.houseId);
                        }}
                      >
                        <span className={s.itemMain}>
                          <span className={s.itemAddress}>{labelOf(item)}</span>
                          {!approved && <span className={s.meta}>ожидает</span>}
                        </span>
                        {selected && <Check size={16} strokeWidth={2.25} className={s.check} aria-hidden />}
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className={s.remove}
                          aria-label={`Покинуть ${labelOf(item)}`}
                          disabled={busy}
                          onClick={() => leaveMutation.mutate(item.houseId)}
                        >
                          <X size={16} strokeWidth={2} aria-hidden />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {switchMutation.isError && (
              <p className={s.error}>{(switchMutation.error as Error).message}</p>
            )}
            {leaveMutation.isError && (
              <p className={s.error}>{(leaveMutation.error as Error).message}</p>
            )}

            {canManage && onAddHouse && (
              <>
                <div className={s.sep} />
                <button
                  type="button"
                  className={s.addItem}
                  onClick={() => {
                    setOpen(false);
                    onAddHouse();
                  }}
                >
                  <Plus size={16} strokeWidth={2} />
                  Добавить
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
