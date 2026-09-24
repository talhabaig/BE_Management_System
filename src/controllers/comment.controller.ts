import { getAuthUser } from '../middleware/auth.middleware';
import * as commentService from '../services/comment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendNoContent, sendSuccess } from '../utils/response';
import type { CommentBody } from '../validators/comment.validator';

export const createComment = asyncHandler(async (req, res) => {
  const body = req.body as CommentBody;
  const comment = await commentService.createComment(getAuthUser(req), req.params.id, body.content);
  sendSuccess(res, comment, 201);
});

export const listComments = asyncHandler(async (req, res) => {
  const query = req.query as unknown as { page: number; limit: number };
  const result = await commentService.listComments(getAuthUser(req), req.params.id, query.page, query.limit);
  sendSuccess(res, result.data, 200, result.pagination);
});

export const updateComment = asyncHandler(async (req, res) => {
  const body = req.body as CommentBody;
  const comment = await commentService.updateComment(getAuthUser(req), req.params.id, body.content);
  sendSuccess(res, comment);
});

export const deleteComment = asyncHandler(async (req, res) => {
  await commentService.deleteComment(getAuthUser(req), req.params.id);
  sendNoContent(res);
});
