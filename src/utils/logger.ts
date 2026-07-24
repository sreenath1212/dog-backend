import winston from 'winston';
import { env } from '../config/env';

// Custom format that scrubs sensitive fields before logging.
// SECURITY: Passwords, tokens, and card data must NEVER appear in logs.
const scrubSensitiveData = winston.format((info) => {
  const scrubFields = ['password', 'passwordHash', 'token', 'refreshToken', 'cardNumber', 'cvv'];
  const scrub = (obj: Record<string, unknown>) => {
    for (const key of Object.keys(obj)) {
      if (scrubFields.some((f) => key.toLowerCase().includes(f))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        scrub(obj[key] as Record<string, unknown>);
      }
    }
  };
  if (info.meta && typeof info.meta === 'object') {
    scrub(info.meta as Record<string, unknown>);
  }
  return info;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    scrubSensitiveData(),
    winston.format.timestamp(),
    env.NODE_ENV === 'production'
      ? winston.format.json() // Structured JSON for log aggregators in production
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
    // In production, add file transport or send to a log aggregator
    ...(env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});
