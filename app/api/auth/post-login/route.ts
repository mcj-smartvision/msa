import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { resolvePostLoginPath } from '@/lib/dashboard/redirect'

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET() {
  try {
    const supabase = createClient()
    let user = null
    let lastError: string | null = null

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          lastError = error.message
        } else {
          user = data.user
          lastError = null
          break
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'fetch failed'
      }
      await sleep(200 * (attempt + 1))
    }

    if (!user?.email) {
      return NextResponse.json(
        { redirectTo: '/login', error: lastError ?? 'no user' },
        { status: lastError ? 503 : 401 }
      )
    }

    const context = await fetchDashboardUserContext(supabase, user.id, user.email)
    return NextResponse.json({ redirectTo: resolvePostLoginPath(context), context })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'auth failed'
    return NextResponse.json({ redirectTo: '/login', error: message }, { status: 503 })
  }
}
