import { getAuthUser } from '../middleware/auth.middleware';
import * as teamService from '../services/team.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendNoContent, sendSuccess } from '../utils/response';
import type { AddTeamMemberInput, CreateTeamInput, ListTeamsQuery, UpdateTeamInput } from '../validators/team.validator';

export const createTeam = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(getAuthUser(req), req.body as CreateTeamInput);
  sendSuccess(res, team, 201);
});

export const listTeams = asyncHandler(async (req, res) => {
  const result = await teamService.listTeams(getAuthUser(req), req.query as unknown as ListTeamsQuery);
  sendSuccess(res, result.data, 200, result.pagination);
});

export const getTeam = asyncHandler(async (req, res) => {
  const team = await teamService.getTeam(getAuthUser(req), req.params.id);
  sendSuccess(res, team);
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await teamService.updateTeam(getAuthUser(req), req.params.id, req.body as UpdateTeamInput);
  sendSuccess(res, team);
});

export const deleteTeam = asyncHandler(async (req, res) => {
  await teamService.deleteTeam(getAuthUser(req), req.params.id);
  sendNoContent(res);
});

export const addMember = asyncHandler(async (req, res) => {
  const member = await teamService.addMember(getAuthUser(req), req.params.id, req.body as AddTeamMemberInput);
  sendSuccess(res, member, 201);
});

export const removeMember = asyncHandler(async (req, res) => {
  await teamService.removeMember(getAuthUser(req), req.params.id, req.params.userId);
  sendNoContent(res);
});

export const listMembers = asyncHandler(async (req, res) => {
  const query = req.query as unknown as { page: number; limit: number };
  const result = await teamService.listMembers(getAuthUser(req), req.params.id, query.page, query.limit);
  sendSuccess(res, result.data, 200, result.pagination);
});
