import { getAuthUser } from '../middleware/auth.middleware';
import * as userService from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import type { ListUsersQuery, UpdateUserInput } from '../validators/user.validator';

export const listUsers = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query as unknown as ListUsersQuery);
  sendSuccess(res, result.data, 200, result.pagination);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUser(getAuthUser(req), req.params.id);
  sendSuccess(res, user);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(getAuthUser(req), req.params.id, req.body as UpdateUserInput);
  sendSuccess(res, user);
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(getAuthUser(req), req.params.id);
  sendSuccess(res, user);
});
