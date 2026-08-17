import type { SupabaseClient } from '@supabase/supabase-js'
import type { SystemRole } from '@/types/admin'
import { ADMIN_EMAIL } from '@/lib/admin/defaults'

/** Platform admin: system_admin / it_admin role, or the configured ADMIN_EMAIL. */
export async function isSystemAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: roleRows, error: roleError } = await supabase
    .from('user_system_roles')
    .select('system_role:system_roles(key, is_active)')
    .eq('user_id', userId)

  if (!roleError && roleRows) {
    const hasRole = roleRows.some((row) => {
      const role = normalizeRole(row as { system_role: unknown })
      return Boolean(role?.is_active && (role.key === 'system_admin' || role.key === 'it_admin'))
    })
    if (hasRole) return true
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data?.email) return false
  return data.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

function normalizeRole(row: { system_role: unknown }) {
  const value = row.system_role
  if (Array.isArray(value)) return value[0] as { key: string; is_active: boolean } | undefined
  return value as { key: string; is_active: boolean } | null
}

export async function getUserSystemRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<SystemRole[]> {
  const { data, error } = await supabase
    .from('user_system_roles')
    .select('system_role:system_roles(*)')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => normalizeRole(row) as SystemRole | null)
    .filter((role): role is SystemRole => Boolean(role?.is_active))
}

export function slugifyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
