export const CATEGORY_LABELS = {
  NOISE: 'Шум и соседи',
  ELEVATOR: 'Лифт',
  PLUMBING: 'Сантехника и трубы',
  ELECTRICITY: 'Электрика',
  REPAIR: 'Ремонт подъезда',
  CLEANING: 'Уборка и двор',
  SECURITY: 'Безопасность',
  OTHER: 'Другое',
};

export const CATEGORY_ORDER = ['ELEVATOR', 'PLUMBING', 'ELECTRICITY', 'REPAIR', 'CLEANING', 'NOISE', 'SECURITY', 'OTHER'];

export const STATUS_LABELS = {
  VOTING: 'На сборе подписей',
  SUBMITTED: 'Передана в УК',
  IN_PROGRESS: 'Решается',
  DELEGATED: 'Передана в службу',
  RESOLVED: 'Сделано',
  REJECTED: 'Отклонена',
  EXPIRED: 'Срок сбора подписей истёк',
};

export const STATUS_EMOJI = {
  VOTING: '🗳',
  SUBMITTED: '📨',
  IN_PROGRESS: '🛠',
  DELEGATED: '➡️',
  RESOLVED: '✅',
  REJECTED: '❌',
  EXPIRED: '⌛',
};

export const PRIORITY_LABELS = {
  NORMAL: 'Обычная',
  EMERGENCY: 'Аварийная',
};

export const RESIDENT_TYPE_LABELS = {
  OWNER: 'Владелец',
  TENANT: 'Арендатор',
};

export const ROLE_LABELS = {
  RESIDENT: 'Житель',
  UK_EMPLOYEE: 'Сотрудник УК',
};

const pad = (n) => String(n).padStart(2, '0');

export function formatDate(date) {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatDateTime(date) {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Разбирает дату в формате ДД.ММ.ГГГГ; возвращает конец дня по локальному времени. */
export function parseRuDate(input) {
  const match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(input.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 23, 59, 59, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(23, 59, 59, 0);
  return result;
}

export function fullName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Житель';
}

export function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
