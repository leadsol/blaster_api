import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from './redis'

// Rate limit configurations for different endpoints
export const rateLimitConfigs = {
  // API endpoints - 100 requests per minute
  api: {
    requests: 100,
    window: '1 m',
  },
  // Campaign sending - 10 requests per minute (to prevent spam)
  campaign: {
    requests: 10,
    window: '1 m',
  },
  // Auth endpoints - 5 requests per minute (brute force protection)
  auth: {
    requests: 5,
    window: '1 m',
  },
  // Webhook - 1000 requests per minute (high throughput for WAHA)
  webhook: {
    requests: 1000,
    window: '1 m',
  },
  // Message sending - 30 per minute (WhatsApp rate limits)
  message: {
    requests: 30,
    window: '1 m',
  },
} as const

type RateLimitType = keyof typeof rateLimitConfigs

// Create rate limiters only if Redis is configured
const rateLimiters: Partial<Record<RateLimitType, Ratelimit>> = {}

function initializeRateLimiters() {
  if (isRedisConfigured() && redis) {
    const redisInstance = redis // TypeScript narrowing
    Object.entries(rateLimitConfigs).forEach(([key, config]) => {
      rateLimiters[key as RateLimitType] = new Ratelimit({
        redis: redisInstance,
        limiter: Ratelimit.slidingWindow(config.requests, config.window as `${number} ${'s' | 'm' | 'h' | 'd'}`),
        analytics: true,
        prefix: `leadsol:ratelimit:${key}`,
      })
    })
  }
}

// Initialize on module load
initializeRateLimiters()

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check rate limit for a given identifier
 * @param type - The type of rate limit to apply
 * @param identifier - Unique identifier (usually user ID or IP)
 * @returns RateLimitResult with success status and metadata
 */
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  // If Redis is not configured, allow all requests (development mode)
  if (!isRedisConfigured() || !rateLimiters[type]) {
    const config = rateLimitConfigs[type]
    return {
      success: true,
      limit: config.requests,
      remaining: config.requests,
      reset: Date.now() + 60000,
    }
  }

  const limiter = rateLimiters[type]!
  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }
}
