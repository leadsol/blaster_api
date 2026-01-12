import { Redis } from '@upstash/redis'

// Check if Redis is configured
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// Create Redis client only if configured
export const redis = UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
  : null

// Helper to check if Redis is available
export const isRedisConfigured = (): boolean => {
  return redis !== null
}
