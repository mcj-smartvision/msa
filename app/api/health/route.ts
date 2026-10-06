import { NextResponse } from 'next/server'
import { getPublicEnvStatus } from '@/shared/lib/env/public'
import { createServiceClient } from '@/shared/lib/supabase/service'

export const dynamic = 'force-dynamic'

/** Quick deployment / config check — open /api/health in browser */
export async function GET() {
  const env = getPublicEnvStatus()
  const ok = env.supabaseConfigured

  let serviceRoleOk = false
  let serviceRoleError: string | null = null

  try {
    const service = createServiceClient()
    const { error } = await service.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) serviceRoleError = error.message
    else serviceRoleOk = true
  } catch (error) {
    serviceRoleError = error instanceof Error ? error.message : 'Service role not configured'
  }

  const healthy = ok && serviceRoleOk

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'misconfigured',
      message: healthy
        ? 'MSA API is running.'
        : 'Supabase configuration problem — Add Member will fail until fixed.',
      env,
      serviceRole: {
        configured: serviceRoleOk,
        error: serviceRoleError,
      },
      hints: healthy
        ? []
        : [
            'In .env.local (local) or Vercel Environment Variables (online), set SUPABASE_SERVICE_ROLE_KEY to the sb_secret key from Supabase → Settings → API.',
            'Use sb_publishable for NEXT_PUBLIC_SUPABASE_ANON_KEY — not the secret key.',
            'After saving, restart npm run dev locally or Redeploy on Vercel.',
          ],
    },
    { status: healthy ? 200 : 503 }
  )
}
