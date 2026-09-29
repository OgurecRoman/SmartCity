import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Spinner, Typography } from '@maxhub/max-ui';
import { ChevronLeft } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../Toast/ToastProvider';
import { messageForApiError } from '../../lib/apiError';
import { useInvalidateAppQueries } from '../../lib/invalidate';
import { queryKeys } from '../../lib/queryKeys';
import type { Company } from '../../types/company';
import s from './EditCompany.module.scss';

type ContactsForm = {
  phone: string;
  email: string;
  address: string;
  workingHours: string;
};

export default function EditCompany() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { invalidateCompany } = useInvalidateAppQueries();

  const isUk = user.role === 'UK_EMPLOYEE';
  const companyId = user.companyId;

  const companyQuery = useQuery({
    queryKey: queryKeys.company,
    queryFn: async () => {
      const { data } = await api.get<Company | null>('/company');
      return data;
    },
    enabled: isUk,
  });

  const [form, setForm] = useState<ContactsForm>({
    phone: '',
    email: '',
    address: '',
    workingHours: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const company = companyQuery.data;
    if (!company || hydrated) return;
    setForm({
      phone: company.phone ?? '',
      email: company.email ?? '',
      address: company.address ?? '',
      workingHours: company.workingHours ?? '',
    });
    setHydrated(true);
  }, [companyQuery.data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (companyId == null) throw new Error('Сотрудник не привязан к УК');
      const { data } = await api.patch<{ company: Company }>(`/company/${companyId}`, {
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        workingHours: form.workingHours.trim(),
      });
      return data.company;
    },
    onSuccess: async () => {
      await invalidateCompany();
      toast.success('Контакты УК сохранены');
      navigate(-1);
    },
    onError: (err) => {
      setLocalError(messageForApiError(err));
      toast.error(err);
    },
  });

  if (!isUk) {
    return (
      <div className={s.page}>
        <Typography.Headline variant="small" asChild>
          <h1>Нет доступа</h1>
        </Typography.Headline>
        <Typography.Body variant="small" className={s.hint}>
          Редактировать контакты могут только сотрудники УК
        </Typography.Body>
        <Button size="small" onClick={() => navigate('/')}>
          На главную
        </Button>
      </div>
    );
  }

  if (companyId == null) {
    return (
      <div className={s.page}>
        <button type="button" className={s.back} onClick={() => navigate(-1)}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          Назад
        </button>
        <Typography.Headline variant="small" asChild>
          <h1>Контакты УК</h1>
        </Typography.Headline>
        <Typography.Body variant="small" className={s.hint}>
          Аккаунт сотрудника не привязан к компании. Обратитесь к администратору.
        </Typography.Body>
      </div>
    );
  }

  const busy = saveMutation.isPending || companyQuery.isLoading;
  const company = companyQuery.data;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!form.phone.trim()) {
      setLocalError('Укажите телефон');
      return;
    }
    saveMutation.mutate();
  };

  const patch = <K extends keyof ContactsForm>(key: K, value: ContactsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={s.page}>
      <div className={s.top}>
        <button type="button" className={s.back} onClick={() => navigate(-1)}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          Назад
        </button>
        <Typography.Headline variant="small" asChild>
          <h1>Контакты УК</h1>
        </Typography.Headline>
        <Typography.Body variant="small" className={s.hint}>
          {company?.name ? `${company.name} — данные для жителей` : 'Данные для жителей в мини-приложении'}
        </Typography.Body>
      </div>

      {companyQuery.isLoading ? (
        <div className={s.state}>
          <Spinner size={40} appearance="themed" />
        </div>
      ) : companyQuery.isError ? (
        <div className={s.state}>
          <Typography.Body variant="medium">{messageForApiError(companyQuery.error)}</Typography.Body>
          <Button size="small" onClick={() => void companyQuery.refetch()}>
            Повторить
          </Button>
        </div>
      ) : !company ? (
        <Typography.Body variant="medium">Компания не найдена</Typography.Body>
      ) : (
        <form className={s.form} onSubmit={onSubmit}>
          <label className={s.field}>
            <span className={s.label}>Телефон</span>
            <input
              className={s.control}
              type="tel"
              value={form.phone}
              disabled={busy}
              autoComplete="tel"
              placeholder="+7 …"
              onChange={(e) => patch('phone', e.target.value)}
              required
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Email</span>
            <input
              className={s.control}
              type="email"
              value={form.email}
              disabled={busy}
              autoComplete="email"
              placeholder="info@example.com"
              onChange={(e) => patch('email', e.target.value)}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Адрес офиса</span>
            <input
              className={s.control}
              type="text"
              value={form.address}
              disabled={busy}
              placeholder="Город, улица, офис"
              onChange={(e) => patch('address', e.target.value)}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Часы работы</span>
            <input
              className={s.control}
              type="text"
              value={form.workingHours}
              disabled={busy}
              placeholder="Пн–Пт 9:00–18:00"
              onChange={(e) => patch('workingHours', e.target.value)}
            />
          </label>

          {localError && (
            <Typography.Body variant="small" className={s.error}>
              {localError}
            </Typography.Body>
          )}

          <Button size="large" stretched type="submit" loading={saveMutation.isPending} disabled={busy}>
            Сохранить
          </Button>
        </form>
      )}
    </div>
  );
}
