import pino from 'pino';

import env from './env';

const transport =
  env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true },
      }
    : undefined;

const log = pino({ level: env.LOG_LEVEL, transport });

export default log;
