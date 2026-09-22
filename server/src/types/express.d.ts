import type { DbUser } from '../services/users.js';

declare global {
  namespace Express {
    interface Request {
      user?: DbUser;
    }
  }
}

export {};