const CODE_MESSAGES: Record<string, string> = {
  unauthorized: 'Войдите через MAX',
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
  service_unavailable: 'Сервис временно недоступен',
  chairman_bound: 'Сначала снимите председателя ТСЖ с должности',
  internal_error: 'Ошибка сервера. Попробуйте позже',
  invalid_json: 'Некорректные данные запроса',
  invalid_upload: 'Не удалось загрузить файл',
  bad_request: 'Некорректный запрос',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Войдите через MAX',
  403: 'Недостаточно прав для этого действия',
  404: 'Не найдено',
  409: 'Действие сейчас недоступно',
  429: 'Слишком много запросов — подождите немного',
  500: 'Ошибка сервера. Попробуйте позже',
  502: 'Сервис временно недоступен',
  503: 'Сервис временно недоступен',
  504: 'Сервер не отвечает. Попробуйте ещё раз',
};

const DEFAULT_FALLBACK = 'Что-то пошло не так';

const TECHNICAL_MESSAGE_RE =
  /^(Request failed with status code \d+|Network Error|timeout of \d+ms exceeded|Network request failed|Failed to fetch)$/i;

export type ApiErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

function isTechnicalMessage(message: string): boolean {
  return TECHNICAL_MESSAGE_RE.test(message.trim());
}

function usableMessage(message: string | undefined): string | null {
  const text = message?.trim();
  if (!text || isTechnicalMessage(text)) return null;
  return text;
}

export function messageForApiError(err: unknown, fallback = DEFAULT_FALLBACK): string {
  const e = err as ApiErrorLike | null;
  const code = e?.code;
  const serverMessage = usableMessage(e?.message);

  if (code && CODE_MESSAGES[code]) {
    if ((code === 'conflict' || code === 'validation_error' || code === 'bad_request' || code === 'invalid_upload') && serverMessage) {
      return serverMessage;
    }
    return CODE_MESSAGES[code];
  }

  if (serverMessage) return serverMessage;

  if (e?.status && STATUS_MESSAGES[e.status]) {
    return STATUS_MESSAGES[e.status];
  }

  const raw = e?.message?.trim() ?? '';
  if (/network/i.test(raw)) return 'Нет соединения с сервером';
  if (/timeout/i.test(raw)) return 'Сервер не отвечает. Попробуйте ещё раз';

  return fallback;
}
