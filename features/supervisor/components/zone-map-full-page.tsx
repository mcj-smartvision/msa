'use client'

'use client'

import { formatZoneLevels } from '@/features/supervisor/components/zone-levels-field'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { ZoneMapCanvas } from '@/features/supervisor/components/zone-map-svg'
import { Button } from '@/shared/components/ui/button'
import {
readProjectZones,
readZoneMapViewSnapshot,
type ZoneMapViewSnapshot,
} from '@/features/supervisor/lib/zone-session-storage'

export function ZoneMapFullPage({ zoneId }: { zoneId: string }) {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const [snapshot, setSnapshot] = useState<ZoneMapViewSnapshot | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let data = readZoneMapViewSnapshot(zoneId)

      if (!data && projectId) {
        const zone = readProjectZones(projectId).find((z) => z.id === zoneId)
        if (zone) {
          const res = await fetch(
            `/api/technical-office/drawings?projectId=${encodeURIComponent(projectId)}`
          )
          const json = (await res.json().catch(() => ({}))) as {
            drawings?: ZoneMapViewSnapshot['drawing'][]
          }
          const drawing = json.drawings?.find((d) => d.id === zone.drawingId)
          if (drawing) data = { zone, drawing, projectId }
        }
      }

      if (!cancelled) {
        setSnapshot(data)
        setReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [zoneId, projectId])

  if (!ready) {
    return (
      <p className="p-8 text-sm text-slate-600" dir="rtl" lang="fa">
        در حال بارگذاری…
      </p>
    )
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center" dir="rtl" lang="fa">
        <p className="text-sm text-slate-700">
          نقشه این زون در دسترس نیست. از صفحه زون‌بندی دوباره روی شمای نقشه کلیک کنید.
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard/site-supervisor?section=drawings">بازگشت به زون‌بندی</Link>
        </Button>
      </div>
    )
  }

  const { zone, drawing } = snapshot

  return (
    <div className="flex min-h-screen flex-col bg-slate-100" dir="rtl" lang="fa">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">{zone.name}</h1>
            <p className="text-xs text-slate-500">
              کد {zone.code?.trim() || '—'} · {drawing.title}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/dashboard/site-supervisor?section=drawings">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              بازگشت به زون‌بندی
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
          <div className="min-h-[min(78vh,900px)] w-full">
            <ZoneMapCanvas drawing={drawing} zones={[zone]} highlightZoneId={zone.id} />
          </div>
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
            شمای نقشه — محدوده علامت‌گذاری‌شده
          </p>
        </div>

        <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">نام زون</dt>
            <dd className="font-semibold text-slate-900">{zone.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">کد زون</dt>
            <dd className="font-mono font-semibold text-[#1e3a5f]">{zone.code?.trim() || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-500">نام پیمانکار زون</dt>
            <dd>{zone.contractor?.trim() || '—'}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-[11px] font-semibold text-slate-500">تراز زون</dt>
            <dd>{formatZoneLevels(zone.levels)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
