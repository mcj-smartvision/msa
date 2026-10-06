/** Persist commercial fields when DB columns (unit_price / quantity_certainty) are missing. */

const PRICE_META = /\[\[unit_price:([0-9]+(?:\.[0-9]+)?)\]\](?:\n|$)/g
const CERT_META = /\[\[qty_certainty:(حدودی|قطعی)\]\](?:\n|$)/g

export function stripPackageCommercialFromNote(note: string | null | undefined): string {
  return (note ?? '').replace(PRICE_META, '').replace(CERT_META, '').trim()
}

export function readPackageUnitPrice(row: Record<string, unknown>): number {
  const fromCol =
    row.unit_price == null || row.unit_price === '' ? null : Number(row.unit_price)
  if (fromCol != null && Number.isFinite(fromCol) && fromCol > 0) return fromCol

  const fields =
    row.schedule_fields && typeof row.schedule_fields === 'object'
      ? (row.schedule_fields as Record<string, unknown>)
      : {}
  const fromFields = Number(fields.unit_price ?? 0)
  if (Number.isFinite(fromFields) && fromFields > 0) return fromFields

  const match = String(row.note ?? '').match(/\[\[unit_price:([0-9]+(?:\.[0-9]+)?)\]\]/)
  if (match) {
    const n = Number(match[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return fromCol != null && Number.isFinite(fromCol) ? Math.max(0, fromCol) : 0
}

export function readPackageQuantityCertainty(
  row: Record<string, unknown>
): 'حدودی' | 'قطعی' {
  if (row.quantity_certainty === 'قطعی' || row.quantity_certainty === 'حدودی') {
    return row.quantity_certainty
  }
  const fields =
    row.schedule_fields && typeof row.schedule_fields === 'object'
      ? (row.schedule_fields as Record<string, unknown>)
      : {}
  if (fields.quantity_certainty === 'قطعی' || fields.quantity_certainty === 'حدودی') {
    return fields.quantity_certainty
  }
  const match = String(row.note ?? '').match(/\[\[qty_certainty:(حدودی|قطعی)\]\]/)
  if (match?.[1] === 'قطعی' || match?.[1] === 'حدودی') return match[1]
  return 'حدودی'
}

export function encodePackageCommercialInNote(
  note: string | null | undefined,
  input: { unitPrice?: number; quantityCertainty?: 'حدودی' | 'قطعی' }
): string | null {
  const base = stripPackageCommercialFromNote(note)
  const parts: string[] = []
  const price = Number(input.unitPrice ?? 0)
  if (Number.isFinite(price) && price > 0) {
    parts.push(`[[unit_price:${Math.round(price * 100) / 100}]]`)
  }
  if (input.quantityCertainty === 'قطعی' || input.quantityCertainty === 'حدودی') {
    parts.push(`[[qty_certainty:${input.quantityCertainty}]]`)
  }
  if (parts.length === 0) return base || null
  return base ? `${parts.join('\n')}\n${base}` : parts.join('\n')
}

export function mergePackageScheduleFields(
  existing: Record<string, unknown> | null | undefined,
  input: { unitPrice?: number; quantityCertainty?: 'حدودی' | 'قطعی' }
): Record<string, unknown> {
  const next = { ...(existing ?? {}) }
  if (input.unitPrice !== undefined) {
    next.unit_price = Math.max(0, Number(input.unitPrice) || 0)
  }
  if (input.quantityCertainty !== undefined) {
    next.quantity_certainty = input.quantityCertainty
  }
  return next
}
