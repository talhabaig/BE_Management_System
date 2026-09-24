import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ParseError extends SyntaxError {
  status?: number;
  type?: string;
}

function isParseError(error: unknown): error is ParseError {
  return error instanceof SyntaxError && typeof error === 'object' && error !== null && 'type' in error;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ code: error.code, message: error.message }, 'Application error');
    }
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (isParseError(error) && error.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
    });
    return;
  }

  if (isParseError(error) && error.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with this value already exists' },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
      return;
    }
    if (error.code === 'P2003') {
      res.status(400).json({
        success: false,
        error: { code: 'FOREIGN_KEY_CONSTRAINT', message: 'Related resource is invalid' },
      });
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Database connection failed');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    return;
  }

  logger.error(
    {
      message: error instanceof Error ? error.message : 'Unknown error',
      ...(env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {}),
    },
    'Unhandled error',
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {}),
    },
  });
}
