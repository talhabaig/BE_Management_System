import { z } from 'zod';
import { idParamSchema, paginationQuerySchema, roleSchema, searchSchema } from './common.validator';

export const listUsersQuerySchema = paginationQuerySchema
  .extend({
    search: searchSchema,
    role: roleSchema.optional(),
  })
  .strict();

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

export const userIdParamSchema = idParamSchema;

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
