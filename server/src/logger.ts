import { pino } from 'pino';
import { env } from './env.ts';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  // A second line of defence if anything ever logs raw headers.
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]', 'headers.cookie'],
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});
