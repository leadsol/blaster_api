import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/auth']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  // API paths that handle their own authentication (QStash callbacks, webhooks, etc.)
  const selfAuthenticatedApiPaths = [
    '/api/campaigns/',  // Campaign processing endpoints (QStash callbacks)
    '/api/waha/webhook', // WAHA webhook
  ]
  const isSelfAuthenticatedApi = selfAuthenticatedApiPaths.some(path => request.nextUrl.pathname.startsWith(path))

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // If there's an error getting the user, treat as not authenticated
    user = null
  }

  // Protected routes - redirect to login if not authenticated
  // Skip redirect for self-authenticated API paths (they handle auth themselves)
  if (!user && !isPublicPath && !isSelfAuthenticatedApi) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login/register pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding/workspace'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
