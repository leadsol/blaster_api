/**
 * Get the application URL for internal API calls and webhooks.
 * This centralizes the URL logic that was previously duplicated across many files.
 */
export function getAppUrl(): string {
  // First priority: explicit NEXT_PUBLIC_APP_URL (if not localhost in production)
  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000') {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // Second priority: Vercel-provided URL (automatically set on Vercel deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Fallback for local development
  return 'http://localhost:3000'
}

/**
 * Get the webhook URL for WAHA configuration.
 * Uses WEBHOOK_URL env var if set (for dev environments pointing to production),
 * otherwise falls back to getAppUrl().
 */
export function getWebhookUrl(): string {
  // Explicit webhook URL override (used in dev to point to production)
  if (process.env.WEBHOOK_URL) {
    return process.env.WEBHOOK_URL
  }

  // Use app URL if it's not localhost
  const appUrl = getAppUrl()
  if (!appUrl.includes('localhost')) {
    return appUrl
  }

  // Production fallback - this should rarely be hit if env vars are properly configured
  // Log a warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('[WEBHOOK] No valid webhook URL configured. WAHA webhooks will not work.')
  }

  return appUrl
}
