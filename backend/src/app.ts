import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import medicationsRoutes from './modules/medications/medications.routes';
import scheduleRoutes from './modules/schedule/schedule.routes';
import { errorHandler } from './middlewares/error.middleware';
import { env } from './config/env';

export const createApp = () => {
  const app = express();

  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(origin)
        ) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '2mb' }));

  // Healthcheck ендпоінт для Docker / AWS ALB / Lambda
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      architecture: 'Modular Monolith (Stateless)',
      clientUrl: env.CLIENT_URL,
      timestamp: new Date().toISOString(),
    });
  });

  // Підключення ізольованих модулів
  app.use('/api/auth', authRoutes);
  app.use('/api/medications', medicationsRoutes);
  app.use('/api/schedule', scheduleRoutes);

  // Глобальний обробник помилок
  app.use(errorHandler);

  return app;
};
