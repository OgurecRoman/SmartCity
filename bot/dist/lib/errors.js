export class AppError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'AppError';
    }
}
export class BackendUnavailableError extends AppError {
    constructor() {
        super(503, 'backend_unavailable', 'Сервис временно недоступен. Попробуйте чуть позже.');
        this.name = 'BackendUnavailableError';
    }
}
export function isAppError(error) {
    return error instanceof AppError;
}
//# sourceMappingURL=errors.js.map