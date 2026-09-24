import type { Response } from 'express';
import type { PaginationMeta } from '../types/http';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, pagination?: PaginationMeta): void {
  if (pagination) {
    res.status(statusCode).json({ success: true, data, pagination });
    return;
  }
  res.status(statusCode).json({ success: true, data });
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
