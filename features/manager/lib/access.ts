import type { SupabaseClient } from '@supabase/supabase-js'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { loadMemberPositionKeys } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { ROLE_DASHBOARD_ACCESS } from '@/features/schedule/lib/access'
import { todayTehranIso } from '@/shared/lib/time/tehran'

export function todayIsoTehran(): string {
  return todayTehranIso()
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
