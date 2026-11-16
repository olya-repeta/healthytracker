import serverless from 'serverless-http';
import { createApp } from './app';

// Точка входу для деплою в AWS Lambda (API Gateway HTTP API / REST API)
const app = createApp();

export const handler = serverless(app);
