import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { listUsersQuerySchema, updateUserSchema, userIdParamSchema } from '../validators/user.validator';

const router = Router();

router.use(authenticate);

router.get('/', authorize('ADMIN', 'MANAGER'), validate({ query: listUsersQuerySchema }), userController.listUsers);
router.get('/:id', validate({ params: userIdParamSchema }), userController.getUser);
router.patch('/:id', validate({ params: userIdParamSchema, body: updateUserSchema }), userController.updateUser);
router.delete('/:id', authorize('ADMIN'), validate({ params: userIdParamSchema }), userController.deactivateUser);

export { router as userRouter };
