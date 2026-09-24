import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { idParamSchema, paginationQuerySchema } from '../validators/common.validator';

const router = Router();

router.use(authenticate);
router.get('/', validate({ query: paginationQuerySchema.strict() }), notificationController.listNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate({ params: idParamSchema }), notificationController.markRead);

export { router as notificationRouter };
