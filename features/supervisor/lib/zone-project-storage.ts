import type { DefinedZone } from '@/features/supervisor/lib/drawings-zoning-mock'

const STORAGE_PREFIX = 'sitepilot-project-zones:'

export type ProjectZoneState = {
  usesZones: boolean | null
  zones: DefinedZone[]
}

const EMPTY_STATE: ProjectZoneState = { usesZones: null, zones: [] }

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`
}

function readRaw(projectId: string): string | null {
  if (typeof window === 'undefined') return null
  const key = storageKey(projectId)
  const fromLocal = localStorage.getItem(key)
  if (fromLocal) return fromLocal

  const fromSession = sessionStorage.getItem(key)
  if (fromSession) {
    try {
      localStorage.setItem(key, fromSession)
      sessionStorage.removeItem(key)
    } catch {
      /* quota */
    }
    return fromSession
  }
  return null
}

export function readProjectZoneState(projectId: string): ProjectZoneState {
  if (typeof window === 'undefined') return EMPTY_STATE
  try {
    const raw = readRaw(projectId)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as Partial<ProjectZoneState>
    return {
      usesZones:
        parsed.usesZones === true || parsed.usesZones === false ? parsed.usesZones : null,
      zones: Array.isArray(parsed.zones) ? (parsed.zones as DefinedZone[]) : [],
    }
  } catch {
    return EMPTY_STATE
  }
}

export function writeProjectZoneState(projectId: string, state: ProjectZoneState) {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify(state)
  try {
    localStorage.setItem(storageKey(projectId), payload)
  } catch {
    /* quota / private mode */
  }
  try {
    sessionStorage.setItem(storageKey(projectId), payload)
  } catch {
    /* quota / private mode */
  }
}
