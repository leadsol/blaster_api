/**
 * Simple logging utility that only logs in development mode.
 * Use this instead of console.log for debug logging that should not appear in production.
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  /**
   * Debug log - only logs in development
   */
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  /**
   * Info log - only logs in development
   */
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log('[INFO]', ...args)
    }
  },

  /**
   * Warning log - logs in all environments
   */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args)
  },

  /**
   * Error log - logs in all environments
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args)
  }
}

export default logger
