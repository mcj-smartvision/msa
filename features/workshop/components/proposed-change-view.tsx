'use client'

const FIELD_LABELS_FA: Record<string, string> = {
  name: 'نام',
  location: 'محل',
  quantity: 'مقدار',
  uom: 'واحد',
  crew: 'گروه کاری',
  note: 'یادداشت',
}

const FIELD_LABELS_EN: Record<string, string> = {
  name: 'Name',
  location: 'Location',
  quantity: 'Quantity',
  uom: 'Unit',
  crew: 'Crew',
  note: 'Note',
}

const FIELD_ORDER = ['name', 'location', 'quantity', 'uom', 'crew', 'note'] as const

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

export function ProposedChangeView({
  current,
  proposed,
  isFa = true,
}: {
  current?: Record<string, unknown> | null
  proposed: Record<string, unknown> | null | undefined
  isFa?: boolean
}) {
  if (!proposed || typeof proposed !== 'object') return null

  const labels = isFa ? FIELD_LABELS_FA : FIELD_LABELS_EN
  const keys = FIELD_ORDER.filter((k) => k in proposed)

  if (keys.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm space-y-2" dir="rtl">
      <p className="font-medium text-amber-950">
        {isFa ? 'تغییر پیشنهادی' : 'Proposed change'}
      </p>
      <div className="overflow-hidden rounded-md border border-amber-100 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-amber-50/80 text-amber-900/80">
            <tr className="text-right">
              <th className="px-2 py-1.5 font-medium">{isFa ? 'فیلد' : 'Field'}</th>
              <th className="px-2 py-1.5 font-medium">{isFa ? 'فعلی' : 'Current'}</th>
              <th className="px-2 py-1.5 font-medium">{isFa ? 'پیشنهادی' : 'Proposed'}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const before = current?.[key]
              const after = proposed[key]
              const changed = displayValue(before) !== displayValue(after)
              return (
                <tr key={key} className="border-t border-amber-50">
                  <td className="px-2 py-1.5 text-slate-600">{labels[key] ?? key}</td>
                  <td className="px-2 py-1.5 text-slate-500">{displayValue(before)}</td>
                  <td
                    className={`px-2 py-1.5 ${changed ? 'font-medium text-emerald-800' : 'text-slate-700'}`}
                  >
                    {displayValue(after)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
