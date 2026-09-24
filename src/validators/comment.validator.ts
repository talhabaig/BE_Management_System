import { z } from 'zod';
import { idParamSchema, paginationQuerySchema } from './common.validator';

export const commentBodySchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

export const commentIdParamSchema = idParamSchema;
export const listCommentsQuerySchema = paginationQuerySchema.strict();

export type CommentBody = z.infer<typeof commentBodySchema>;
