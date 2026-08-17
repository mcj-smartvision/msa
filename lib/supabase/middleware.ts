import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  let authUnreachable = false
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
      authUnreachable = false
      break
    } catch (error) {
      authUnreachable = true
      console.error('[middleware] Supabase auth unavailable:', error)
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
      }
    }
  }

  if (authUnreachable && !user) {
    // Allow auth routes and static assets when Supabase is unreachable.
    if (
      request.nextUrl.pathname.startsWith('/login') ||
      request.nextUrl.pathname.startsWith('/signup') ||
      request.nextUrl.pathname.startsWith('/forgot-password') ||
      request.nextUrl.pathname.startsWith('/reset-password') ||
      request.nextUrl.pathname.startsWith('/api/health')
    ) {
      return supabaseResponse
    }
  }

  const pathname = request.nextUrl.pathname

  if (pathname === '/') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/reports') ||
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/first-login') ||
    request.nextUrl.pathname.startsWith('/site-ops') ||
    request.nextUrl.pathname.startsWith('/finance') ||
    request.nextUrl.pathname.startsWith('/project') ||
    request.nextUrl.pathname.startsWith('/accountant-app') ||
    request.nextUrl.pathname.startsWith('/choose-accountant-shell')

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
