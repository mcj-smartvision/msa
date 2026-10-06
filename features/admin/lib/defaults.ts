import { CONSTRUCTION_ROLES } from '@/features/admin/lib/construction-roles'

export const ADMIN_EMAIL = 'mojtaba421@gmail.com'

export const DEFAULT_SITE_POSITIONS = CONSTRUCTION_ROLES.map((role) => ({
  title: role.title,
  key: role.key,
  description: role.description,
}))
