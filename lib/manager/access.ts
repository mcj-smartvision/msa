import type { SupabaseClient } from '@supabase/supabase-js'
import { isSystemAdmin } from '@/lib/admin/access'
import { loadMemberPositionKeys } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import { ROLE_DASHBOARD_ACCESS } from '@/lib/schedule/access'

export function todayIsoTehran(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' })
}

export async function assertManagerAccess(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<void> {
  if (await isSystemAdmin(supabase, userId)) return
  const keys = await loadMemberPositionKeys(supabase, userId, projectId)
  const allowed = ROLE_DASHBOARD_ACCESS.manager as string[]
  if (!keys.some((key) => allowed.includes(key))) {
    throw new SiteOpsError('FORBIDDEN', 'فقط مدیر پروژه به داشبورد مدیر دسترسی دارد')
  }
}
