/**
 * @file features/project-store/components/store-inspector.tsx
 * @purpose کامپوننت UI — ذخیره پیشرفت و overlay اعداد داشبورد (store-inspector)
 * @safe-to-edit CAREFUL
 * @affects ذخیره پیشرفت و overlay اعداد داشبورد
 * @depends-on shared/components/ui/button, shared/components/ui/input, features/project-store/use-project-store, features/project-store/use-project-store-sync, features/project-store/lib/export, features/project-store/lib/schema, features/manager/lib/format, features/manager/components/manager-ui
 */

'use client'

import { useMemo, useState } from 'react'
import { Database, Download } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useProjectStore, useStoreEvm, useStoreWeeklyPpc } from '@/features/project-store/use-project-store'
import { useProjectStoreSync } from '@/features/project-store/use-project-store-sync'
import { downloadText } from '@/features/project-store/lib/export'
import { TASK_COLUMNS, type TaskColumn, type TaskItem } from '@/features/project-store/lib/schema'
import { compactToman, faNumber, jalaliDate } from '@/features/manager/lib/format'
import { EmptyNote, LoadingRows, SectionCard } from '@/features/manager/components/manager-ui'
import { STORE_INSPECTOR_COPY as copy } from '@/features/project-store/config'

const MAX_ROWS = 300

function formatCell(task: TaskItem, column: TaskColumn): string {
  const value = task[column.key]
  if (value == null || value === '') return '—'
  switch (column.unit) {
    case 'percent':
    case 'points':
      return faNumber(value as number, 2)
    case 'weight':
      return faNumber(value as number, 3)
    case 'toman':
      return compactToman(value as number)
    case 'date':
      return jalaliDate(value as string)
    case 'binary':
      return String(value)
    case 'flag':
      return value ? copy.yes : ''
    case 'logs': {
      const entries = Object.entries(value as Record<string, number>)
      return entries.length ? entries.slice(-5).map(([d, g]) => copy.logLine(jalaliDate(d), faNumber(g, 2))).join(copy.listSep) : '—'
    }
    default:
      return String(value)
  }
}

const index = (v: number | null | undefined) => (v == null ? '—' : faNumber(v, 2))

/** Every task record of the project store with its derived weekly and EVM values, downloadable as JSON / CSV. */
export function StoreInspector({ projectId }: { projectId: string | null }) {
  useProjectStoreSync(projectId)
  const ready = useProjectStore((s) => Boolean(projectId) && s.snapshot?.projectId === projectId)
  const status = useProjectStore((s) => s.status)
  const error = useProjectStore((s) => s.error)
  const tasks = useProjectStore((s) => s.tasks)
  const taskOrder = useProjectStore((s) => s.taskOrder)
  const weekStart = useProjectStore((s) => s.weekStart)
  const evm = useStoreEvm(projectId)
  const weekly = useStoreWeeklyPpc(projectId)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = taskOrder.map((id) => tasks[id]!).filter(Boolean)
    return q ? all.filter((t) => t.title.toLowerCase().includes(q) || t.wbs.toLowerCase().includes(q)) : all
  }, [taskOrder, tasks, query])

  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const download = (kind: 'json' | 'csv') => {
    const state = useProjectStore.getState()
    if (kind === 'json') downloadText(`msa-store-${stamp()}.json`, state.exportJSON(), 'application/json')
    else downloadText(`msa-store-${stamp()}.csv`, state.exportCSV(), 'text/csv;charset=utf-8')
  }

  return (
    <SectionCard
      title={copy.title}
      icon={<Database className="h-4 w-4" aria-hidden />}
      hint={copy.hint}
      action={
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="h-9" disabled={!ready} onClick={() => download('json')}>
            <Download className="h-4 w-4" aria-hidden />
            JSON
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9" disabled={!ready} onClick={() => download('csv')}>
            <Download className="h-4 w-4" aria-hidden />
            CSV
          </Button>
        </div>
      }
    >
      {!projectId ? (
<EmptyNote title={copy.noProject} />
      ) : !ready ? (
        status === 'error' ? <EmptyNote tone="error" title={copy.loadFailed} description={error ?? undefined} /> : <LoadingRows rows={4} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-8">
            {[
              [copy.week, weekStart ? jalaliDate(weekStart) : '—'],
              [
                copy.ppcWeek,
                weekly?.ppc.ppc == null
                  ? '—'
                  : copy.ppcValue(
                      faNumber(weekly.ppc.completed),
                      faNumber(weekly.ppc.committed),
                      faNumber(Math.round(weekly.ppc.ppc)),
                      Boolean(weekly.ppc.provisional)
                    ),
              ],
              ['SPI', index(evm?.spi)],
              ['SPI(t)', index(evm?.spiT)],
              ['CPI', index(evm?.cpi)],
              ['TCPI', index(evm?.tcpi)],
              ['EV', evm ? compactToman(evm.ev) : '—'],
              ['AC', evm ? compactToman(evm.ac) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-[#faf9f7] px-2.5 py-1.5">
                <span className="block text-[10.5px] text-slate-500">{label}</span>
                <b className="tabular-nums text-slate-800">{value}</b>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
placeholder={copy.searchPh}
              className="h-9 w-56 text-sm"
            />
            <span className="text-[11px] text-slate-500">
              {copy.activityCount(faNumber(rows.length))}{rows.length > MAX_ROWS ? copy.truncated(faNumber(MAX_ROWS)) : ''}
            </span>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-[11.5px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                <tr>
                  {TASK_COLUMNS.map((c) => (
                    <th key={String(c.key)} className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-start font-semibold" title={String(c.key)}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_ROWS).map((t) => (
                  <tr key={t.id} className={t.unsynced ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50/50'}>
                    {TASK_COLUMNS.map((c) => (
                      <td
                        key={String(c.key)}
                        className={`border-b border-slate-100 px-2 py-1 ${c.unit === 'text' || c.unit === 'logs' ? 'max-w-[260px] truncate' : 'whitespace-nowrap tabular-nums'}`}
                        title={c.unit === 'text' || c.unit === 'logs' ? formatCell(t, c) : undefined}
                      >
                        {formatCell(t, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
