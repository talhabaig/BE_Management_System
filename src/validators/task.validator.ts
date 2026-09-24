import { z } from 'zod';
import {
  idParamSchema,
  paginationQuerySchema,
  searchSchema,
  taskPrioritySchema,
  taskStatusSchema,
} from './common.validator';

const titleSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().trim().max(5000);

export const taskFilterSchema = z.object({
  search: searchSchema,
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  teamId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  deadlineFrom: z.coerce.date().optional(),
  deadlineTo: z.coerce.date().optional(),
});

function deadlineOrder<T extends { deadlineFrom?: Date; deadlineTo?: Date }>(data: T): boolean {
  if (data.deadlineFrom && data.deadlineTo) {
    return data.deadlineFrom.getTime() <= data.deadlineTo.getTime();
  }
  return true;
}

export const createTaskSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    deadline: z.coerce.date().optional(),
    teamId: z.string().uuid(),
    assignedToId: z.string().uuid().optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    deadline: z.coerce.date().nullable().optional(),
    teamId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

export const assignTaskSchema = z
  .object({
    assignedToId: z.string().uuid(),
  })
  .strict();

export const updateTaskStatusSchema = z
  .object({
    status: taskStatusSchema,
  })
  .strict();

export const listTasksQuerySchema = paginationQuerySchema
  .merge(taskFilterSchema)
  .extend({
    sortBy: z.enum(['createdAt', 'updatedAt', 'deadline', 'priority', 'status', 'title']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine(deadlineOrder, {
    message: 'deadlineFrom must be before or equal to deadlineTo',
    path: ['deadlineFrom'],
  });

export const taskIdParamSchema = idParamSchema;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskFilters = z.infer<typeof taskFilterSchema>;
