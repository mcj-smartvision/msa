'use client'

export function SiteOpsSummaryCards({
  gate,
  score,
  blockers,
  forecast,
  labels,
}: {
  gate: string
  score: number | string
  blockers: number | string
  forecast: string
  labels: { gate: string; score: string; blockers: string; forecast: string }
}) {
  const gateTone =
    gate === 'CONTROL_READY'
      ? 'border-emerald-600/40 bg-emerald-50 text-emerald-900'
      : 'border-amber-600/40 bg-amber-50 text-amber-950'

  const cards = [
    { label: labels.gate, value: gate, className: gateTone },
    { label: labels.score, value: score, className: 'border-slate-300 bg-white' },
    { label: labels.blockers, value: blockers, className: 'border-slate-300 bg-white' },
    { label: labels.forecast, value: forecast, className: 'border-slate-300 bg-white' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-md border px-4 py-3 ${card.className}`}>
          <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{card.value}</div>
        </div>
      ))}
    </div>
  )
}
