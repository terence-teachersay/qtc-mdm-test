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
    format.errors({ stack: true }),
    format.json()
    // format.printf(({ timestamp, level, message, stack, ...meta }) => {
    //   const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
    //   return `${timestamp} [${level}] ${stack || message} ${metaString}`;
    // })
  ),
  transports: [
    new transports.Console(),
    // Only log error into file.
    // The info and warning will be logged in console, and aws cloudwatch agent will pick them up and send to cloudwatch.
    new transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
})