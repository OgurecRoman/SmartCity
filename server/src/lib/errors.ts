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

export const errors = {
  badRequest: (message: string, code = 'bad_request') => new AppError(400, code, message),
  unauthorized: (message = 'Требуется авторизация', code = 'unauthorized') => new AppError(401, code, message),
  forbidden: (message = 'Недостаточно прав', code = 'forbidden') => new AppError(403, code, message),
  notFound: (message = 'Не найдено', code = 'not_found') => new AppError(404, code, message),
  conflict: (message: string, code = 'conflict') => new AppError(409, code, message),
  unavailable: (message: string, code = 'service_unavailable') => new AppError(503, code, message),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
