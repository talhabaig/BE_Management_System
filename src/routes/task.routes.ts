import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';
import * as taskController from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { commentBodySchema, listCommentsQuerySchema } from '../validators/comment.validator';
import {
  assignTaskSchema,
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from '../validators/task.validator';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: createTaskSchema }), taskController.createTask);
router.get('/', validate({ query: listTasksQuerySchema }), taskController.listTasks);
router.post('/:id/assign', validate({ params: taskIdParamSchema, body: assignTaskSchema }), taskController.assignTask);
router.patch(
  '/:id/status',
  validate({ params: taskIdParamSchema, body: updateTaskStatusSchema }),
  taskController.updateTaskStatus,
);
router.post(
  '/:id/comments',
  validate({ params: taskIdParamSchema, body: commentBodySchema }),
  commentController.createComment,
);
router.get(
  '/:id/comments',
  validate({ params: taskIdParamSchema, query: listCommentsQuerySchema }),
  commentController.listComments,
);
router.get('/:id', validate({ params: taskIdParamSchema }), taskController.getTask);
router.patch('/:id', validate({ params: taskIdParamSchema, body: updateTaskSchema }), taskController.updateTask);
router.delete('/:id', validate({ params: taskIdParamSchema }), taskController.deleteTask);

export { router as taskRouter };
