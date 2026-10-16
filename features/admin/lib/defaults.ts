/**
 * @file features/admin/lib/defaults.ts
 * @purpose منطق دامنه — کنترل سنتر و مدیریت اعضا/پروژه (defaults)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on features/admin/lib/construction-roles
 */

import { CONSTRUCTION_ROLES } from '@/features/admin/lib/construction-roles'

export const ADMIN_EMAIL = 'mojtaba421@gmail.com'

export const DEFAULT_SITE_POSITIONS = CONSTRUCTION_ROLES.map((role) => ({
  title: role.title,
  key: role.key,
  description: role.description,
}))
