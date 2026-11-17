import dotenv from 'dotenv';

dotenv.config();

const sanitizeEnvValue = (val?: string): string =>
  (val || '').trim().replace(/^["']|["']$/g, '');

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL:
    sanitizeEnvValue(process.env.DATABASE_URL) ||
    'postgresql://postgres:postgres@localhost:5432/vitatrack?schema=public',
  JWT_SECRET:
    sanitizeEnvValue(process.env.JWT_SECRET) ||
    'medtracker-super-secret-jwt-key-2026',
  JWT_EXPIRES_IN: sanitizeEnvValue(process.env.JWT_EXPIRES_IN) || '7d',
  GOOGLE_CLIENT_ID: sanitizeEnvValue(process.env.GOOGLE_CLIENT_ID),
  CLIENT_URL:
    sanitizeEnvValue(process.env.CLIENT_URL) ||
    'https://13.60.250.145.nip.io',
  CORS_ORIGIN:
    sanitizeEnvValue(process.env.CORS_ORIGIN) ||
    'https://13.60.250.145.nip.io,http://13.60.250.145.nip.io,http://13.60.250.145,http://localhost:5173,http://localhost:4173,http://localhost',
};
