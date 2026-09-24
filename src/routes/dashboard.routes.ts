import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { dashboardQuerySchema } from '../validators/dashboard.validator';

const router = Router();

router.get('/summary', authenticate, validate({ query: dashboardQuerySchema }), dashboardController.getSummary);

export { router as dashboardRouter };
