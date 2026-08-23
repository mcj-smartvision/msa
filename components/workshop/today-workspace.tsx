'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/admin/shared'

export function TodayWorkspace() {
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
      setMessage(data.error || 'خطا')
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
      setMessage(data.error || 'ثبت نشد')
      return
    }
    setMessage('عملکرد ثبت شد')
    await load()
  }

  if (!projectId) return <p className="text-sm">پروژه را انتخاب کنید.</p>

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        title="امروز"
        description="کارهای ارسال‌شده به امروز و ثبت عملکرد"
        actions={
          <label className="text-sm">
            تاریخ
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
          هنوز چیزی برای امروز نیست. از صفحه «برنامه» یک زیرمجموعه را به امروز بفرستید.
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
                    محل: {pkg?.location ?? '—'} · برنامه امروز: {String(item.planned_qty)} {pkg?.uom}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-sm">
                    مقدار واقعی
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
                    وضعیت
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={form.status}
                      onChange={(e) =>
                        setActualForms((f) => ({ ...f, [id]: { ...form, status: e.target.value } }))
                      }
                    >
                      <option value="done">انجام شد</option>
                      <option value="partial">ناقص</option>
                      <option value="blocked">مسدود</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    یادداشت
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={form.note}
                      onChange={(e) =>
                        setActualForms((f) => ({ ...f, [id]: { ...form, note: e.target.value } }))
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void saveActual(id)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  ثبت عملکرد
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
