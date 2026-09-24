import { z } from 'zod';
import { idParamSchema, paginationQuerySchema, searchSchema } from './common.validator';

const teamNameSchema = z.string().trim().min(2).max(100);
const teamDescriptionSchema = z.string().trim().max(1000);

export const createTeamSchema = z
  .object({
    name: teamNameSchema,
    description: teamDescriptionSchema.optional(),
    managerId: z.string().uuid(),
  })
  .strict();

export const updateTeamSchema = z
  .object({
    name: teamNameSchema.optional(),
    description: teamDescriptionSchema.nullable().optional(),
    managerId: z.string().uuid().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

export const listTeamsQuerySchema = paginationQuerySchema
  .extend({
    search: searchSchema,
  })
  .strict();

export const teamIdParamSchema = idParamSchema;

export const teamMemberParamsSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
  })
  .strict();

export const addTeamMemberSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();

export const listMembersQuerySchema = paginationQuerySchema.strict();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
