import { Router } from 'express';
import * as commentController from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { commentBodySchema, commentIdParamSchema } from '../validators/comment.validator';

const router = Router();

router.use(authenticate);
router.patch('/:id', validate({ params: commentIdParamSchema, body: commentBodySchema }), commentController.updateComment);
router.delete('/:id', validate({ params: commentIdParamSchema }), commentController.deleteComment);

export { router as commentRouter };
