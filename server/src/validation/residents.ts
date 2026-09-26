import { z } from 'zod';
import { positiveInt } from './common.js';

export const listResidentsQuerySchema = z.object({
  houseId: positiveInt,
});
