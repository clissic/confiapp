import { z } from 'zod';

/** Health no recibe payload; schema reservado para extensiones. */
export const healthQuerySchema = z.object({}).strict();
