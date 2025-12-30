import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().positive().default(3000),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  databaseUrl: z.string().url(),
  redisUrl: z.string().url(),
  queue: z
    .object({
      concurrency: z.coerce.number().int().positive().default(3),
    })
    .default({}),
});

const envConfig = {
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  logLevel: process.env.LOG_LEVEL,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  queue: {
    concurrency: process.env.QUEUE_CONCURRENCY,
  },
};

export const config = configSchema.parse(envConfig);

export type Config = typeof config;
