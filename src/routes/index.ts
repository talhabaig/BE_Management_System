import { Router } from 'express';
import { authRouter } from './auth.routes';
import { commentRouter } from './comment.routes';
import { dashboardRouter } from './dashboard.routes';
import { healthRouter } from './health.routes';
import { notificationRouter } from './notification.routes';
import { taskRouter } from './task.routes';
import { teamRouter } from './team.routes';
import { userRouter } from './user.routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/teams', teamRouter);
router.use('/tasks', taskRouter);
router.use('/comments', commentRouter);
router.use('/notifications', notificationRouter);
router.use('/dashboard', dashboardRouter);

export { router as apiRouter };
