import type { DbUser } from '../services/users.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: DbUser;
  }
}
