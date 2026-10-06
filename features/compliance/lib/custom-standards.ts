/**
 * User-defined standards not in the regional catalog.
 */

import type { ComplianceStandard, ComplianceStandardCategory, CustomStandardEntry } from './types'

export const CUSTOM_STANDARD_KEY_PREFIX = 'custom_'

export function isCustomStandardKey(key: string): boolean {
  return key.startsWith(CUSTOM_STANDARD_KEY_PREFIX)
}

export function customStandardKey(id: string): string {
  return `${CUSTOM_STANDARD_KEY_PREFIX}${id}`
}

export function createCustomStandardId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Date.now().toString(36)
}

export function customEntryToStandard(entry: CustomStandardEntry): ComplianceStandard {
  return {
    key: customStandardKey(entry.id),
    code: entry.code.trim(),
    name: entry.name.trim(),
    category: normalizeCategory(entry.category),
    family: 'Custom',
    aiReferenceId: `custom:${entry.id}`,
    description: entry.description?.trim() || undefined,
  }
}

export function listCustomStandards(entries: CustomStandardEntry[] | undefined): ComplianceStandard[] {
  if (!entries?.length) return []
  return entries.map(customEntryToStandard)
}

export function normalizeCategory(value?: string): ComplianceStandardCategory {
  const allowed: ComplianceStandardCategory[] = ['safety', 'quality', 'environmental', 'bim', 'contract', 'general']
  if (value && allowed.includes(value as ComplianceStandardCategory)) {
    return value as ComplianceStandardCategory
  }
  return 'general'
}
