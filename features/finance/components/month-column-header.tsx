'use client'

export function MonthColumnHeader({
  label,
  fa,
  onChangeLabel,
  onInsertBefore,
  onInsertAfter,
  onRemove,
  canRemove,
}: {
  label: string
  fa: boolean
  onChangeLabel: (value: string) => void
  onInsertBefore: () => void
  onInsertAfter: () => void
  onRemove: () => void
  canRemove: boolean
}) {
  const buttonClass =
    'inline-flex h-5 items-center justify-center rounded border border-slate-300 bg-white px-1 text-[10px] font-semibold leading-none text-slate-700 hover:bg-slate-50 disabled:opacity-40'

  return (
    <div className="flex min-w-[8.5rem] flex-col items-center gap-1 px-1 py-1">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={buttonClass}
          title={fa ? 'افزودن ستون قبل از این ماه' : 'Add a column before this month'}
          onClick={onInsertBefore}
        >
          {fa ? '+ قبل' : '+ before'}
        </button>
        <button
          type="button"
          className={buttonClass}
          title={fa ? 'حذف این ماه' : 'Remove this month'}
          disabled={!canRemove}
          onClick={onRemove}
        >
          ×
        </button>
        <button
          type="button"
          className={buttonClass}
          title={fa ? 'افزودن ستون بعد از این ماه' : 'Add a column after this month'}
          onClick={onInsertAfter}
        >
          {fa ? 'بعد +' : 'after +'}
        </button>
      </div>
      <input
        value={label}
        onChange={(event) => onChangeLabel(event.target.value)}
        aria-label={fa ? 'نام ماه' : 'Month name'}
        className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-[10px] font-semibold text-slate-800 outline-none focus:border-orange-400"
      />
    </div>
  )
}
