import { taskFilterSchema } from './task.validator';

export const dashboardQuerySchema = taskFilterSchema
  .omit({ search: true })
  .strict()
  .refine(
    (data) => {
      if (data.deadlineFrom && data.deadlineTo) {
        return data.deadlineFrom.getTime() <= data.deadlineTo.getTime();
      }
      return true;
    },
    {
      message: 'deadlineFrom must be before or equal to deadlineTo',
      path: ['deadlineFrom'],
    },
  );
