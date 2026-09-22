import type { DbUser } from '../services/users.js';
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: DbUser;
  }
}