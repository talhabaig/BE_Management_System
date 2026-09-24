import { Router } from 'express';
import * as healthController from '../controllers/health.controller';

const router = Router();

router.get('/', healthController.getHealth);

export { router as healthRouter };
