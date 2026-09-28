const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Войдите через MAX или проверьте VITE_DEV_USER_ID',
  forbidden: 'Недостаточно прав для этого действия',
  not_found: 'Не найдено',
  conflict: 'Действие сейчас недоступно',
  validation_error: 'Проверьте заполненные поля',
  onboarding_required: 'Сначала подтвердите вступление в дом',
  apartment_not_found: 'Такой квартиры нет в этом доме',
  building_not_found: 'В этой точке нет дома — ткните ближе к зданию',
  membership_pending: 'Заявка в этот дом уже на рассмотрении',
  already_member: 'Вы уже житель этого дома',
  reopen_limit: 'Заявку уже возвращали — повторно нельзя',
  reopen_window_expired: 'Срок возврата заявки истёк (7 дней)',
  unavailable: 'Сервис временно недоступен',
  chairman_bound: 'Сначала снимите председателя ТСЖ с должности',
};

export type ApiErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

export function messageForApiError(err: unknown, fallback = 'Что-то пошло не так'): string {
  const e = err as ApiErrorLike | null;
  const code = e?.code;
  if (code && CODE_MESSAGES[code]) {
    if ((code === 'conflict' || code === 'validation_error') && e?.message) {
      return e.message;
    }
    return CODE_MESSAGES[code];
  }
  if (e?.message && e.message.trim()) return e.message;
  return fallback;
}
