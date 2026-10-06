import type { ReactNode } from 'react';

/** Light-blue block that lays out one or more formula lines in textbook notation. */
export function MathBlock({ children }: { children: ReactNode }) {
  return (
    <div
      dir="ltr"
      className="flex flex-col items-center gap-3 overflow-x-auto rounded-xl bg-sky-50 px-4 py-3 font-serif text-[15px] text-slate-800 ring-1 ring-inset ring-sky-100"
    >
      {children}
    </div>
  )
}

export function MathLine({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 whitespace-nowrap">{children}</div>
}

/** Italic variable with an optional subscript. */
export function V({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <span className="italic">
      {children}
      {sub != null ? <sub className="text-[0.7em] not-italic">{sub}</sub> : null}
    </span>
  )
}

export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="inline-flex flex-col items-center align-middle leading-tight">
      <span className="px-1 pb-0.5">{num}</span>
      <span className="w-full border-t border-slate-700" aria-hidden />
      <span className="px-1 pt-0.5">{den}</span>
    </span>
  )
}

export function Op({ children }: { children: ReactNode }) {
  return <span className="px-0.5 not-italic">{children}</span>
}

export function Sum({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center">
      <span className="pl-0.5 pr-1 text-[1.35em] leading-none">Σ</span>
      {children}
    </span>
  )
}

/** Plain number in upright digits. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="not-italic tabular-nums">{children}</span>
}
