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

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use((req, res, next) => {
    const helmetOptions = {
      crossOriginResourcePolicy: { policy: 'cross-origin' as const },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
          'img-src': ["'self'", 'data:', 'https://unpkg.com'],
          'connect-src': ["'self'"],
          'font-src': ["'self'", 'https://unpkg.com', 'data:'],
        },
      },
    };
    if (req.path.startsWith('/api-docs')) {
      helmet(helmetOptions)(req, res, next);
      return;
    }
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' as const },
    })(req, res, next);
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
  app.get(['/api-docs', '/api-docs/'], (_req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Role-Based Task Management API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    #swagger-ui { max-width: 1460px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api-docs.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
    });
  </script>
</body>
</html>`);
  });
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
