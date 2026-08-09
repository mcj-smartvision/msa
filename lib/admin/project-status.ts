/** Shared status labels for admin project control center (Persian UI). */

export type ProjectStatusKey = 'planning' | 'active' | 'completed' | 'suspended' | 'at_risk' | 'paused'

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: 'برنامه‌ریزی',
  active: 'فعال',
  completed: 'تکمیل‌شده',
  suspended: 'متوقف',
  at_risk: 'در خطر',
  paused: 'متوقف موقت',
}

export function resolveProjectStatusKey(status: string, isActive: boolean): ProjectStatusKey {
  const s = (status || '').toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'suspended' || s === 'paused') return 'suspended'
  if (s === 'at_risk' || s === 'at-risk') return 'at_risk'
  if (s === 'planning') return 'planning'
  if (!isActive && s === 'active') return 'paused'
  if (s === 'active') return 'active'
  return (s as ProjectStatusKey) || 'planning'
}

export function estimateProgress(status: string, isActive: boolean): number {
  const key = resolveProjectStatusKey(status, isActive)
  switch (key) {
    case 'completed':
      return 100
    case 'active':
      return 68
    case 'at_risk':
      return 42
    case 'suspended':
    case 'paused':
      return 35
    case 'planning':
    default:
      return 18
  }
}
