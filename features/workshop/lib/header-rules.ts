import { toIsoDateOnly } from '@/features/schedule/lib/dates';

export function collectDateEnvelope(
  starts: Array<string | null | undefined>,
  finishes: Array<string | null | undefined>
): { start: string | null; finish: string | null } {
  const startList = starts.map((value) => toIsoDateOnly(value)).filter((value): value is string => Boolean(value))
  const finishList = finishes
    .map((value) => toIsoDateOnly(value))
    .filter((value): value is string => Boolean(value))
  return {
    start: startList.length ? startList.reduce((earliest, next) => (next < earliest ? next : earliest)) : null,
    finish: finishList.length ? finishList.reduce((latest, next) => (next > latest ? next : latest)) : null,
  }
}

export function seedNewPackageProgressFields(
  fields: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return {
    ...(fields ?? {}),
    physical_percent_complete: 0,
    percent_complete: 0,
  }
}
