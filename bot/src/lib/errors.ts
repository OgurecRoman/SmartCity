export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Бэкенд не отвечает — пользователю показываем заглушку, а не стек ошибки. */
export class BackendUnavailableError extends AppError {
  constructor() {
    super(503, 'backend_unavailable', 'Сервис временно недоступен. Попробуйте чуть позже.');
    this.name = 'BackendUnavailableError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
