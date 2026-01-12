import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getRateLimitHeaders, RateLimitResult } from './rate-limit'
import { createClient } from './supabase/server'

type RateLimitType = 'api' | 'campaign' | 'auth' | 'webhook' | 'message'

interface ApiHandlerOptions {
  rateLimit?: RateLimitType
  requireAuth?: boolean
}

interface ApiContext {
  user: { id: string; email: string } | null
  rateLimitResult: RateLimitResult | null
}

type ApiHandler = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse>

/**
 * Wrapper for API routes with rate limiting and auth
 */
export function withApiHandler(
  handler: ApiHandler,
  options: ApiHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { rateLimit = 'api', requireAuth = true } = options

    try {
      // Get user for rate limiting identifier
      let user: { id: string; email: string } | null = null

      if (requireAuth) {
        const supabase = await createClient()
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (error || !authUser) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }

        user = { id: authUser.id, email: authUser.email || '' }
      }

      // Check rate limit
      const identifier = user?.id || getClientIP(request) || 'anonymous'
      const rateLimitResult = await checkRateLimit(rateLimit, identifier)

      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
          },
          {
            status: 429,
            headers: getRateLimitHeaders(rateLimitResult)
          }
        )
      }

      // Call the actual handler
      const response = await handler(request, { user, rateLimitResult })

      // Add rate limit headers to response
      const headers = new Headers(response.headers)
      Object.entries(getRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
        headers.set(key, value)
      })

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (error) {
      console.error('API Error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string | null {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return null
}

/**
 * Simple rate limit check for routes that don't use the wrapper
 */
export async function simpleRateLimit(
  request: NextRequest,
  type: RateLimitType = 'api'
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const ip = getClientIP(request) || 'anonymous'
  const result = await checkRateLimit(type, ip)

  if (!result.success) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: getRateLimitHeaders(result)
        }
      ),
    }
  }

  return { allowed: true }
}
