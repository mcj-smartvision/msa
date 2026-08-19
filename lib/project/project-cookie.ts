/** Global "active project" selection, shared across pages via cookie (like the locale cookie). */

export const PROJECT_COOKIE = 'sitepilot_active_project'
export const ALL_PROJECTS_SCOPE = 'all'

export function readProjectCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${PROJECT_COOKIE}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export function writeProjectCookie(projectId: string) {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${PROJECT_COOKIE}=${encodeURIComponent(projectId)};path=/;max-age=${maxAge};SameSite=Lax`
}

export function isAllProjectsScope(value: string | null | undefined): boolean {
  return !value || value === ALL_PROJECTS_SCOPE
}
