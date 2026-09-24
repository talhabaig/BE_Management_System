import { getAuthUser } from '../middleware/auth.middleware';
import * as notificationService from '../services/notification.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const listNotifications = asyncHandler(async (req, res) => {
  const query = req.query as unknown as { page: number; limit: number };
  const actor = getAuthUser(req);
  const result = await notificationService.listNotifications(actor, query.page, query.limit);
  sendSuccess(res, result.data, 200, result.pagination);
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead(getAuthUser(req), req.params.id);
  sendSuccess(res, notification);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(getAuthUser(req));
  sendSuccess(res, result);
});
