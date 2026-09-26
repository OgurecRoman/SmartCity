import { z } from 'zod';
import { positiveInt } from './common.js';

export const listCamerasQuerySchema = z.object({
  houseId: positiveInt.optional(),
});
