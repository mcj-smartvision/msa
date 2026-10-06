import { ALL_PROJECTS_SCOPE, readProjectCookie } from '@/shared/lib/project/project-cookie'
import type { AdminProject } from '@/shared/types/admin'

export function resolveAdminProjectId(
  projects: AdminProject[],
  options?: {
    queryProjectId?: string | null
    scope?: string | null
    fallbackProjectId?: string | null
  }
): string {
  const ids = new Set(projects.map((project) => project.id))
  const candidates = [
    options?.queryProjectId,
    options?.scope && options.scope !== ALL_PROJECTS_SCOPE ? options.scope : null,
    options?.fallbackProjectId,
    readProjectCookie(),
  ]

  for (const candidate of candidates) {
    if (candidate && ids.has(candidate)) return candidate
  }

  return projects.length === 1 ? projects[0].id : ''
}

export function buildAddMemberHref(projectId?: string, roleKey?: string): string {
  const params = new URLSearchParams()
  if (projectId) params.set('projectId', projectId)
  if (roleKey) params.set('role', roleKey)
  const query = params.toString()
  return `/admin/members/new${query ? `?${query}` : ''}`
}
