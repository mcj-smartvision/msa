'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { DefinedZone } from '@/lib/supervisor/drawings-zoning-mock'
import type { ProjectDrawing } from '@/lib/technical-office/drawings-shared'
import { writeZoneMapViewSnapshot } from '@/lib/supervisor/zone-session-storage'
import { ZoneMapCanvas } from '@/components/supervisor/zone-map-svg'
import { cn } from '@/lib/utils'

type ZoneMapThumbnailButtonProps = {
  zone: DefinedZone
  drawing: ProjectDrawing
  projectId?: string
  className?: string
  label?: string
}

export function zoneMapPageHref(zoneId: string, projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
  return `/dashboard/site-supervisor/zones/${encodeURIComponent(zoneId)}${qs}`
}

export function ZoneMapThumbnailButton({
  zone,
  drawing,
  projectId,
  className,
  label,
}: ZoneMapThumbnailButtonProps) {
  const href = zoneMapPageHref(zone.id, projectId)

  function persistSnapshot() {
    writeZoneMapViewSnapshot({ zone, drawing, projectId })
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseDown={persistSnapshot}
      onClick={persistSnapshot}
      className={cn(
        'group block w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:border-sky-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer',
        className
      )}
      aria-label={label ?? `بزرگنمایی نقشه ${zone.name} در صفحه جدید`}
    >
      <div className="aspect-[4/3] w-full pointer-events-none bg-slate-50">
        <ZoneMapCanvas drawing={drawing} zones={[zone]} highlightZoneId={zone.id} />
      </div>
      <p className="flex items-center justify-center gap-1 border-t border-slate-100 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-600 group-hover:text-sky-700">
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        کلیک — نمایش بزرگ در صفحه جدید
      </p>
    </Link>
  )
}
