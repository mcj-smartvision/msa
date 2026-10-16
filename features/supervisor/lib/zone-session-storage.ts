/**
 * @file features/supervisor/lib/zone-session-storage.ts
 * @purpose منطق دامنه — سرپرست کارگاه و گزارش روزانه (zone-session-storage)
 * @safe-to-edit CAREFUL
 * @affects سرپرست کارگاه و گزارش روزانه
 * @depends-on features/supervisor/lib/drawings-zoning-mock, features/technical-office/lib/drawings-shared, features/supervisor/lib/zone-project-storage
 */

import type { DefinedZone } from '@/features/supervisor/lib/drawings-zoning-mock'
import type { ProjectDrawing } from '@/features/technical-office/lib/drawings-shared'
import { readProjectZoneState } from '@/features/supervisor/lib/zone-project-storage'

const SNAPSHOT_PREFIX = 'sitepilot-zone-map-view:'

export type ZoneMapViewSnapshot = {
  zone: DefinedZone
  drawing: ProjectDrawing
  projectId?: string
}

export function readProjectZones(projectId: string): DefinedZone[] {
  return readProjectZoneState(projectId).zones
}

export function readZoneMapViewSnapshot(zoneId: string): ZoneMapViewSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${SNAPSHOT_PREFIX}${zoneId}`)
    if (!raw) return null
    return JSON.parse(raw) as ZoneMapViewSnapshot
  } catch {
    return null
  }
}

export function writeZoneMapViewSnapshot(snapshot: ZoneMapViewSnapshot) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${SNAPSHOT_PREFIX}${snapshot.zone.id}`, JSON.stringify(snapshot))
  } catch {
    /* quota / private mode */
  }
}
