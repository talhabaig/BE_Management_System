import { Router } from 'express';
import * as teamController from '../controllers/team.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  addTeamMemberSchema,
  createTeamSchema,
  listMembersQuerySchema,
  listTeamsQuerySchema,
  teamIdParamSchema,
  teamMemberParamsSchema,
  updateTeamSchema,
} from '../validators/team.validator';

const router = Router();

router.use(authenticate);

router.post('/', authorize('ADMIN'), validate({ body: createTeamSchema }), teamController.createTeam);
router.get('/', validate({ query: listTeamsQuerySchema }), teamController.listTeams);
router.get('/:id', validate({ params: teamIdParamSchema }), teamController.getTeam);
router.patch('/:id', validate({ params: teamIdParamSchema, body: updateTeamSchema }), teamController.updateTeam);
router.delete('/:id', authorize('ADMIN'), validate({ params: teamIdParamSchema }), teamController.deleteTeam);
router.get('/:id/members', validate({ params: teamIdParamSchema, query: listMembersQuerySchema }), teamController.listMembers);
router.post('/:id/members', validate({ params: teamIdParamSchema, body: addTeamMemberSchema }), teamController.addMember);
router.delete(
  '/:id/members/:userId',
  validate({ params: teamMemberParamsSchema }),
  teamController.removeMember,
);

export { router as teamRouter };
