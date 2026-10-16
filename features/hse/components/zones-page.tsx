/**
 * @file features/hse/components/zones-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (zones-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/ui, features/hse/lib/mock-data, features/hse/config
 */

'use client'

import { MapPinned } from 'lucide-react'
import { RiskBadge } from '@/features/hse/components/badges'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { getCamera, getRule, HSE_ZONES } from '@/features/hse/lib/mock-data'
import { HSE_COMMON_COPY, HSE_ZONES_COPY } from '@/features/hse/config'

export function ZonesPage() {
  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title={HSE_ZONES_COPY.title}
        description={HSE_ZONES_COPY.description}
      />

      <Panel title={HSE_ZONES_COPY.panelTitle} description={HSE_ZONES_COPY.zoneCount(HSE_ZONES.length)}>
        {HSE_ZONES.length === 0 ? (
          <EmptyRow>{HSE_ZONES_COPY.empty}</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">{HSE_ZONES_COPY.colZone}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ZONES_COPY.colRisk}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ZONES_COPY.colArea}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ZONES_COPY.colCameras}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_ZONES_COPY.colRules}</th>
                  <th className="pb-2 font-semibold">{HSE_ZONES_COPY.colNotes}</th>
                </tr>
              </thead>
              <tbody>
                {HSE_ZONES.map((zone) => (
                  <tr key={zone.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2.5 pl-3">
                      <p className="font-medium text-slate-900">{zone.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{zone.code}</p>
                    </td>
                    <td className="py-2.5 pl-3">
                      <RiskBadge value={zone.risk} />
                    </td>
                    <td className="py-2.5 pl-3 text-slate-700">{zone.areaLabel}</td>
                    <td className="py-2.5 pl-3">
                      <p className="font-semibold tabular-nums text-slate-900">{zone.cameraIds.length}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {zone.cameraIds.map((id) => getCamera(id)?.code ?? id).join(HSE_COMMON_COPY.listSep)}
                      </p>
                    </td>
                    <td className="py-2.5 pl-3">
                      <p className="font-semibold tabular-nums text-slate-900">{zone.ruleIds.length}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {zone.ruleIds.map((id) => getRule(id)?.code ?? id).join(HSE_COMMON_COPY.listSep)}
                      </p>
                    </td>
                    <td className="max-w-[280px] py-2.5 text-xs leading-snug text-slate-600">
                      {zone.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={HSE_ZONES_COPY.editorTitle}
        description={HSE_ZONES_COPY.editorDesc}
      >
        <div className="rounded border border-slate-300 bg-slate-50 px-4 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded border border-slate-300 bg-white p-2">
              <MapPinned className="h-5 w-5 text-slate-600" />
            </div>
            <div className="min-w-0 space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{HSE_ZONES_COPY.editorHeading}</p>
              <p>
                {HSE_ZONES_COPY.editorBody}
              </p>
              <ul className="list-disc space-y-1 pr-5 text-xs text-slate-600">
                <li>
                  {HSE_ZONES_COPY.editorLi1}
                </li>
                <li>
                  {HSE_ZONES_COPY.editorLi2}
                </li>
                <li>
                  {HSE_ZONES_COPY.editorLi3}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
