import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { swaggerSpec } from '../docs/swagger';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { apiRouter } from './routes';
import { logger } from './utils/logger';
import swaggerUi from 'swagger-ui-express';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use((req, res, next) => {
    const helmetOptions = { crossOriginResourcePolicy: { policy: 'cross-origin' as const } };
    if (req.path.startsWith('/api-docs')) {
      helmet({ ...helmetOptions, contentSecurityPolicy: false })(req, res, next);
      return;
    }
    helmet(helmetOptions)(req, res, next);
  });

  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        name: 'Role-Based Task Management API',
        health: '/api/health',
        docs: '/api-docs',
      },
    });
  });
  app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
