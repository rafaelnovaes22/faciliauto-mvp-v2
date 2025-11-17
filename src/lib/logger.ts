import pino from 'pino';
import { isDev } from '../config/env';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
});

export default logger;
