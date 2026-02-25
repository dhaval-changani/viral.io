/* eslint-disable no-console */
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info: (message: string, ...args: unknown[]): void => {
    console.log(formatMessage('info', message), ...args);
  },
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(formatMessage('warn', message), ...args);
  },
  error: (message: string, ...args: unknown[]): void => {
    console.error(formatMessage('error', message), ...args);
  },
  debug: (message: string, ...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message), ...args);
    }
  },
};
