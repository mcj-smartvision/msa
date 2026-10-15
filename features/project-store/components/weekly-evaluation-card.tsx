'use client'

import { useMemo, useState } from 'react'
import { ClipboardCheck, Lock } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { evaluationWeekStart, useProjectStore, useStoreWeeklyPpc } from '@/features/project-store/use-project-store'
import { addDays, SITE_WEEK_DAYS } from '@/features/project-store/lib/weekly-engine'
import { ROOT_CAUSE_CATEGORIES, ROOT_CAUSE_FA, type RootCauseCategory } from '@/features/wwp/lib/policy'
import { faNumber, jalaliDate } from '@/features/manager/lib/format'
import { cn } from '@/shared/lib/utils'

type RowDraft = { category: RootCauseCategory | ''; note: string }

/**
 * The weekly commitment cycle on the supervisor's page: this week's frozen commitments, and from Thursday
 * 16:00 every commitment of the week under evaluation that fell short, each needing a recorded root cause.
 */
export function WeeklyEvaluationCard({ projectId }: { projectId: string | null }) {
  const snapshot = useProjectStore((s) => (projectId && s.snapshot?.projectId === projectId ? s.snapshot : null))
  const entries = useProjectStore((s) => s.entries)
  const tasks = useProjectStore((s) => s.tasks)
  const weekStart = useProjectStore((s) => s.weekStart)
  const nowMs = useProjectStore((s) => s.nowMs)
  const thisWeek = useStoreWeeklyPpc(projectId)
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const evalWeek = weekStart ? evaluationWeekStart(weekStart, nowMs) : null
  const missed = useMemo(() => {
    if (!snapshot || !evalWeek) return []
    const weeks = useProjectStore.getState().getWeekEvaluation(evalWeek)
    return [...weeks.entries()]
      .filter(([, w]) => w.ppcStatus === 0)
      .map(([id, w]) => ({ id, week: w, task: tasks[id] }))
      .sort((a, b) => (a.task?.wbs ?? '').localeCompare(b.task?.wbs ?? '', undefined, { numeric: true }))
  }, [snapshot, evalWeek, entries, tasks])

  const recorded = useMemo(() => {
    const out = new Map<string, { category: string; note: string | null }>()
    for (const r of snapshot?.rnc ?? []) if (r.weekStart === evalWeek) out.set(r.activityId, r)
    return out
  }, [snapshot, evalWeek])

  if (!snapshot || !weekStart || !thisWeek) return null
  const open = missed.filter((m) => !recorded.has(m.id))

  async function save(id: string) {
    const draft = drafts[id]
    if (!draft?.category || !evalWeek) return
    if (draft.category === 'other' && !draft.note.trim()) {
      setError('برای علت «سایر» توضیح لازم است')
      return
    }
    setSavingId(id)
    setError(null)
    try {
      await useProjectStore.getState().setWeeklyEvaluation(id, draft.category, { note: draft.note.trim() || undefined, weekStart: evalWeek })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت علت ناموفق بود')
    } finally {
      setSavingId(null)
    }
  }

  const { ppc } = thisWeek
  const weekEnd = addDays(weekStart, SITE_WEEK_DAYS - 1)

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ClipboardCheck className="h-4 w-4 text-slate-500" aria-hidden />
          تعهدات هفتگی ({jalaliDate(weekStart)} تا {jalaliDate(weekEnd)})
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
          title="تعهدات هر هفته شنبه ساعت 00:00 از برنامهٔ پیش‌بینی‌شدهٔ همان لحظه ثابت می‌شوند."
        >
          <Lock className="h-3 w-3" aria-hidden />
          تعهدات قفل شد
        </span>
      </div>
      <p className="text-xs leading-6 text-slate-600">
        {faNumber(ppc.committed)} فعالیت در این هفته سهم برنامه دارند؛{' '}
        {ppc.provisional
          ? `تا این لحظه ${faNumber(ppc.completed)} فعالیت سهم هفته را کامل کرده‌اند. ارزیابی پنج‌شنبه ساعت 16:00 باز می‌شود.`
          : `${faNumber(ppc.completed)} فعالیت سهم هفته را کامل کردند (PPC ${ppc.ppc == null ? '—' : `${faNumber(Math.round(ppc.ppc))}٪`}).`}
      </p>

      {evalWeek && missed.length > 0 ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-800">
            علت عدم تحقق — هفتهٔ {jalaliDate(evalWeek)} ({faNumber(open.length)} مورد بدون علت از {faNumber(missed.length)})
          </p>
          {snapshot.rncMissing ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ثبت علت هنوز فعال نیست؛ مدیر سیستم باید فایل database/108-weekly-commitment-rnc.sql را اجرا کند.
            </p>
          ) : null}
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
          <ul className="space-y-2">
            {missed.map(({ id, week, task }) => {
              const done = recorded.get(id)
              const draft = drafts[id] ?? { category: '', note: '' }
              return (
                <li key={id} className={cn('rounded-lg border px-3 py-2 text-xs', done ? 'border-slate-200 bg-slate-50' : 'border-rose-200 bg-rose-50/60')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="truncate font-semibold text-slate-900" title={task?.title}>
                      {task?.wbs ? `${task.wbs} · ` : ''}
                      {task?.title ?? id}
                    </b>
                    <span className="tabular-nums text-rose-700">
                      {faNumber(week.actualSum, 2)} از {faNumber(week.target, 2)} واحد سهم هفته
                    </span>
                  </div>
                  {done ? (
                    <p className="mt-1 text-slate-600">
                      علت ثبت‌شده: <b>{ROOT_CAUSE_FA[done.category as RootCauseCategory] ?? done.category}</b>
                      {done.note ? ` — ${done.note}` : ''}
                    </p>
                  ) : snapshot.rncMissing ? null : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        aria-label="علت عدم تحقق"
                        className="h-11 rounded-md border border-slate-300 bg-white px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        value={draft.category}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [id]: { ...draft, category: e.target.value as RootCauseCategory | '' } }))}
                      >
                        <option value="">انتخاب علت…</option>
                        {ROOT_CAUSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {ROOT_CAUSE_FA[c]}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={draft.note}
                        maxLength={500}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [id]: { ...draft, note: e.target.value } }))}
                        placeholder={draft.category === 'other' ? 'توضیح (الزامی)' : 'توضیح (اختیاری)'}
                        className="h-11 min-w-[12rem] flex-1 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-11"
                        disabled={!draft.category || savingId != null}
                        onClick={() => void save(id)}
                      >
                        {savingId === id ? 'در حال ثبت…' : 'ثبت علت'}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
