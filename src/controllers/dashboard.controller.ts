import { getAuthUser } from '../middleware/auth.middleware';
import * as dashboardService from '../services/dashboard.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import type { TaskFilters } from '../validators/task.validator';

export const getSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getDashboardSummary(getAuthUser(req), req.query as unknown as TaskFilters);
  sendSuccess(res, summary);
});
