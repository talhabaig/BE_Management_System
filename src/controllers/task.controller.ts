import { getAuthUser } from '../middleware/auth.middleware';
import * as taskService from '../services/task.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendNoContent, sendSuccess } from '../utils/response';
import type {
  AssignTaskInput,
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from '../validators/task.validator';

export const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(getAuthUser(req), req.body as CreateTaskInput);
  sendSuccess(res, task, 201);
});

export const listTasks = asyncHandler(async (req, res) => {
  const result = await taskService.listTasks(getAuthUser(req), req.query as unknown as ListTasksQuery);
  sendSuccess(res, result.data, 200, result.pagination);
});

export const getTask = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(getAuthUser(req), req.params.id);
  sendSuccess(res, task);
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(getAuthUser(req), req.params.id, req.body as UpdateTaskInput);
  sendSuccess(res, task);
});

export const deleteTask = asyncHandler(async (req, res) => {
  await taskService.deleteTask(getAuthUser(req), req.params.id);
  sendNoContent(res);
});

export const assignTask = asyncHandler(async (req, res) => {
  const body = req.body as AssignTaskInput;
  const task = await taskService.assignTask(getAuthUser(req), req.params.id, body.assignedToId);
  sendSuccess(res, task);
});

export const updateTaskStatus = asyncHandler(async (req, res) => {
  const body = req.body as UpdateTaskStatusInput;
  const task = await taskService.updateTaskStatus(getAuthUser(req), req.params.id, body.status);
  sendSuccess(res, task);
});
