/**
 * @file features/hse/components/rules-page.tsx
 * @purpose کامپوننت UI — ایمنی، بهداشت و محیط زیست (rules-page)
 * @safe-to-edit CAREFUL
 * @affects ایمنی، بهداشت و محیط زیست
 * @depends-on features/hse/components/badges, features/hse/components/ui, shared/components/ui/button, shared/components/ui/input, shared/components/ui/select, features/hse/lib/mock-data, features/hse/lib/types, shared/lib/utils, features/hse/config
 */

'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { SeverityBadge, severityLabel } from '@/features/hse/components/badges'
import { EmptyRow, HsePageHeader, Panel } from '@/features/hse/components/ui'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { HSE_RULES, HSE_ZONES } from '@/features/hse/lib/mock-data'
import type { HseRule, Severity } from '@/features/hse/lib/types'
import { cn } from '@/shared/lib/utils'
import { HSE_COMMON_COPY, HSE_RULES_COPY } from '@/features/hse/config'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']

export function RulesPage() {
  const [rules, setRules] = useState<HseRule[]>(() =>
    HSE_RULES.map((r) => ({ ...r, zoneIds: [...r.zoneIds] }))
  )
  const [selectedId, setSelectedId] = useState<string | null>(rules[0]?.id ?? null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const selected = rules.find((r) => r.id === selectedId) ?? null

  function patchSelected(patch: Partial<HseRule>) {
    if (!selected) return
    setRules((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)))
  }

  function toggleZone(zoneId: string) {
    if (!selected) return
    const has = selected.zoneIds.includes(zoneId)
    patchSelected({
      zoneIds: has
        ? selected.zoneIds.filter((id) => id !== zoneId)
        : [...selected.zoneIds, zoneId],
    })
  }

  function saveRule() {
    if (!selected) return
    setSavedNote(HSE_RULES_COPY.savedNote(selected.code))
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title={HSE_RULES_COPY.title}
        description={HSE_RULES_COPY.description}
        actions={
          savedNote ? (
            <div className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
              {savedNote}
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel title={HSE_RULES_COPY.tableTitle} description={HSE_RULES_COPY.policyCount(rules.length)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                  <th className="pb-2 pl-3 font-semibold">{HSE_RULES_COPY.colRule}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_RULES_COPY.colSeverity}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_RULES_COPY.colConfidence}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_RULES_COPY.colDuration}</th>
                  <th className="pb-2 pl-3 font-semibold">{HSE_RULES_COPY.colCooldown}</th>
                  <th className="pb-2 font-semibold">{HSE_RULES_COPY.colEnabled}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const active = selected?.id === rule.id
                  return (
                    <tr
                      key={rule.id}
                      onClick={() => setSelectedId(rule.id)}
                      className={cn(
                        'cursor-pointer border-b border-slate-100 last:border-0',
                        active ? 'bg-amber-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <td className="py-2 pl-3">
                        <p className="font-medium text-slate-900">{rule.name}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {rule.code} · {rule.category}
                        </p>
                      </td>
                      <td className="py-2 pl-3">
                        <SeverityBadge value={rule.severity} />
                      </td>
                      <td className="py-2 pl-3 tabular-nums text-slate-700">
                        {Math.round(rule.confidenceThreshold * 100)}٪
                      </td>
                      <td className="py-2 pl-3 tabular-nums text-slate-700">
                        {rule.durationThresholdSec}ث
                      </td>
                      <td className="py-2 pl-3 tabular-nums text-slate-700">{rule.cooldownSec}ث</td>
                      <td className="py-2 text-slate-700">{rule.enabled ? HSE_COMMON_COPY.yes : HSE_COMMON_COPY.no}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title={HSE_RULES_COPY.configTitle}
          description={selected ? selected.code : HSE_RULES_COPY.selectRule}
          actions={
            selected ? (
              <Button size="sm" onClick={saveRule}>
                <Save className="h-3.5 w-3.5" />
                {HSE_COMMON_COPY.save}
              </Button>
            ) : null
          }
        >
          {!selected ? (
            <EmptyRow>{HSE_RULES_COPY.empty}</EmptyRow>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                <p className="mt-1 text-xs text-slate-600">{selected.description}</p>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="font-medium text-slate-600">{HSE_RULES_COPY.severity}</span>
                <Select
                  value={selected.severity}
                  onValueChange={(v) => patchSelected({ severity: v as Severity })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {severityLabel[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">{HSE_RULES_COPY.confidence}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    className="h-9 text-sm"
                    value={selected.confidenceThreshold}
                    onChange={(e) =>
                      patchSelected({ confidenceThreshold: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">{HSE_RULES_COPY.duration}</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 text-sm"
                    value={selected.durationThresholdSec}
                    onChange={(e) =>
                      patchSelected({ durationThresholdSec: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">{HSE_RULES_COPY.cooldown}</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 text-sm"
                    value={selected.cooldownSec}
                    onChange={(e) =>
                      patchSelected({ cooldownSec: Number(e.target.value) || 0 })
                    }
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={selected.enabled}
                  onChange={(e) => patchSelected({ enabled: e.target.checked })}
                />
                {HSE_RULES_COPY.ruleEnabled}
              </label>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">{HSE_RULES_COPY.activeZones}</p>
                <ul className="space-y-1.5 rounded border border-slate-200 p-2">
                  {HSE_ZONES.map((zone) => (
                    <li key={zone.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          checked={selected.zoneIds.includes(zone.id)}
                          onChange={() => toggleZone(zone.id)}
                        />
                        <span>
                          <span className="font-medium text-slate-900">{zone.name}</span>
                          <span className="mr-1 font-mono text-[11px] text-slate-500">
                            {zone.code}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
