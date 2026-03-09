// For more information about this file see https://dove.feathersjs.com/guides/cli/logging.html
import { createLogger, format, transports } from 'winston'

/**
 * Set up logger and store in logs folder
 */
export const logger =  createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.splat(),
    format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}] ${stack || message} ${metaString}`;
    })
  ),
  transports: [
    new transports.Console(),
    //TODO Logging into file might be slow in future.
    //Ok for now.  we might want to store in something faster.  in AWS?
    new transports.File({ filename: 'logs/info.log', level: 'info' }),
    new transports.File({ filename: 'logs/warn.log', level: 'warn' }),
    new transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
})