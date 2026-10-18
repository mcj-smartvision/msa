/**
 * @file features/project-init/lib/i18n/utils.ts
 * @purpose تنظیمات و برچسب‌ها — راه‌اندازی پروژه (utils)
 * @safe-to-edit YES
 * @affects راه‌اندازی پروژه
 * @depends-on nothing
 */

import type { FormDictionary, FormLocale, OptionMap } from './types'
import { en } from './locales/en'
import { de } from './locales/de'
import { fa } from './locales/fa'

const dictionaries: Record<FormLocale, FormDictionary> = { en, de, fa }

/** Normalize cookie/query values; unknown and legacy fr/ar → Persian default. */
export function normalizeLocale(value?: string): FormLocale {
  if (value === 'de' || value === 'en' || value === 'fa') return value
  return 'fa'
}

export function getDictionary(locale?: string): FormDictionary {
  return dictionaries[normalizeLocale(locale)]
}

export function isRtlLocale(locale?: string): boolean {
  return normalizeLocale(locale) === 'fa'
}

export function localizeOptions(
  locale: string | undefined,
  map: OptionMap,
  values: readonly { value: string }[]
) {
  return values.map((item) => ({
    value: item.value,
    label: map[item.value] ?? item.value,
  }))
}

export function tPath(dict: FormDictionary, path: string): string {
  const parts = path.split('.')
  let current: unknown = dict
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

/** Merge locale-specific standard labels over English catalog labels */
export function getStandardLabel(locale: string | undefined, value: string, fallback: string): string {
  const dict = getDictionary(locale)
  return dict.standards[value] ?? fallback
}

export function getStandardRegionLabel(locale: string | undefined, region: string, fallback: string): string {
  const dict = getDictionary(locale)
  return dict.standardRegionGroups[region] ?? fallback
}
