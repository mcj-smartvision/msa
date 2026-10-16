/**
 * @file features/workshop/components/today-workspace.tsx
 * @purpose کامپوننت UI — بسته‌های اجرایی و تأیید کارگاه (today-workspace)
 * @safe-to-edit CAREFUL
 * @affects بسته‌های اجرایی و تأیید کارگاه
 * @depends-on features/admin/components/shared, shared/components/common/voice-to-text-button, features/workshop/components/uom-display
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/features/admin/components/shared'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { QtyWithUom } from '@/features/workshop/components/uom-display'
import { WORKSHOP_COPY } from '@/features/workshop/lib/ui-copy'

export function TodayWorkspace({ showBanner = true }: { showBanner?: boolean }) {
  const projectId = useSearchParams().get('projectId') ?? ''
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [message, setMessage] = useState<string | null>(null)
  const [actualForms, setActualForms] = useState<Record<string, { qty: string; status: string; note: string }>>({})

  const load = useCallback(async () => {
    if (!projectId) return
    const res = await fetch(`/api/workshop/today?projectId=${projectId}&date=${date}`)
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || WORKSHOP_COPY.genericError)
      return
    }
    setItems(data.items ?? [])
  }, [projectId, date])

  useEffect(() => {
    void load()
  }, [load])

  async function saveActual(assignmentId: string) {
    const form = actualForms[assignmentId] ?? { qty: '', status: 'partial', note: '' }
    const res = await fetch(`/api/workshop/assignments/${assignmentId}/actuals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actualQty: Number(form.qty),
        status: form.status,
        note: form.note,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || WORKSHOP_COPY.today.notSaved)
      return
    }
    setMessage(WORKSHOP_COPY.today.actualSaved)
    await load()
  }

  if (!projectId) return <p className="text-sm">{WORKSHOP_COPY.selectProject}</p>

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        showBanner={showBanner}
        title={WORKSHOP_COPY.today.title}
        description={WORKSHOP_COPY.today.description}
        actions={
          <label className="text-sm">
            {WORKSHOP_COPY.today.date}
            <input
              type="date"
              className="mt-1 block rounded-lg border px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        }
      />
      {message && <p className="text-sm rounded-lg border bg-white px-3 py-2">{message}</p>}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-600">
          {WORKSHOP_COPY.today.empty}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const pkg = item.workshop_packages as {
              name?: string
              location?: string
              uom?: string
              quantity?: number
            } | null
            const id = String(item.id)
            const form = actualForms[id] ?? { qty: '', status: 'partial', note: '' }
            return (
              <li key={id} className="rounded-2xl border bg-white p-4 space-y-3">
                <div>
                  <p className="font-semibold">{pkg?.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {WORKSHOP_COPY.today.locationToday(pkg?.location ?? '—')}{' '}
                    <QtyWithUom qty={String(item.planned_qty)} uom={typeof pkg?.uom === 'string' ? pkg.uom : null} />
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-sm">
                    {WORKSHOP_COPY.today.actualQty}
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={form.qty}
                      onChange={(e) =>
                        setActualForms((f) => ({ ...f, [id]: { ...form, qty: e.target.value } }))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    {WORKSHOP_COPY.today.status}
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={form.status}
                      onChange={(e) =>
                        setActualForms((f) => ({ ...f, [id]: { ...form, status: e.target.value } }))
                      }
                    >
                      <option value="done">{WORKSHOP_COPY.today.done}</option>
                      <option value="partial">{WORKSHOP_COPY.today.partial}</option>
                      <option value="blocked">{WORKSHOP_COPY.today.blocked}</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    {WORKSHOP_COPY.today.note}
                    <div className="mt-1 flex gap-2">
                      <input
                        className="w-full rounded-lg border px-3 py-2"
                        value={form.note}
                        onChange={(e) =>
                          setActualForms((f) => ({ ...f, [id]: { ...form, note: e.target.value } }))
                        }
                      />
                      <VoiceToTextButton
                        onTranscript={(text) =>
                          setActualForms((f) => ({
                            ...f,
                            [id]: { ...form, note: form.note ? `${form.note} ${text}` : text },
                          }))
                        }
                      />
                    </div>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void saveActual(id)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {WORKSHOP_COPY.today.saveActual}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
