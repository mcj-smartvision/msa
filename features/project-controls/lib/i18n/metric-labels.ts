/**
 * @file features/project-controls/lib/i18n/metric-labels.ts
 * @purpose Live FA/EN labels for data quality and KPI status chips
 * @safe-to-edit YES
 * @affects manager/background, inbox, controls KPI cards
 * @depends-on shared/lib/i18n/make-live-copy, shared/types/project-controls
 */

import type { DataQuality, KpiStatus } from '@/shared/types/project-controls'
import { makeLiveCopy } from '@/shared/lib/i18n/make-live-copy'

const DQ_FA: Record<DataQuality, string> = {
  ok: 'داده کامل',
  missing: 'داده موجود نیست',
  stale: 'داده قدیمی',
  invalid: 'داده نامعتبر',
}

const DQ_EN: Record<DataQuality, string> = {
  ok: 'Complete data',
  missing: 'Data missing',
  stale: 'Stale data',
  invalid: 'Invalid data',
}

export const DATA_QUALITY_COPY = makeLiveCopy({
  fa: DQ_FA,
  en: DQ_EN as unknown as typeof DQ_FA,
})

/** @deprecated Use DATA_QUALITY_COPY — kept so existing imports keep working via re-export. */
export const DATA_QUALITY_FA = DATA_QUALITY_COPY

const STATUS_FA: Record<KpiStatus, string> = {
  green: 'سالم',
  yellow: 'هشدار',
  red: 'بحرانی',
  gray: 'بدون وضعیت',
}

const STATUS_EN: Record<KpiStatus, string> = {
  green: 'Healthy',
  yellow: 'Warning',
  red: 'Critical',
  gray: 'No status',
}

export const KPI_STATUS_LABELS = makeLiveCopy({
  fa: STATUS_FA,
  en: STATUS_EN as unknown as typeof STATUS_FA,
})

const TITLE_FA: Record<string, string> = {
  at: 'زمان واقعی سپری‌شده (AT)',
  es: 'زمان کسب‌شده (ES)',
  spi_t: 'شاخص عملکرد زمانی مبتنی بر زمان (SPI(t))',
  sv_t: 'انحراف زمانی مبتنی بر زمان (SV(t))',
  eac_t: 'مدت پیش‌بینی‌شدهٔ تکمیل (EAC(t))',
  delay_forecast: 'تأخیر پیش‌بینی‌شده (روز تقویمی)',
  tcpi_bac: 'شاخص عملکرد لازم برای تکمیل در سقف بودجه (TCPI-BAC)',
  ppc: 'درصد تحقق برنامهٔ هفتگی (PPC)',
  pv: 'ارزش برنامه‌ای (PV٪)',
  ev: 'ارزش کسب‌شده (EV٪)',
  spi: 'شاخص عملکرد زمانی (SPI)',
  cpi: 'شاخص عملکرد هزینه (CPI)',
}

const TITLE_EN: Record<string, string> = {
  at: 'Actual Time elapsed (AT)',
  es: 'Earned Schedule (ES)',
  spi_t: 'Time-based schedule performance (SPI(t))',
  sv_t: 'Time-based schedule variance (SV(t))',
  eac_t: 'Forecast duration to complete (EAC(t))',
  delay_forecast: 'Forecast delay (calendar days)',
  tcpi_bac: 'To-Complete Performance Index (TCPI-BAC)',
  ppc: 'Percent Plan Complete (PPC)',
  pv: 'Planned Value (PV%)',
  ev: 'Earned Value (EV%)',
  spi: 'Schedule Performance Index (SPI)',
  cpi: 'Cost Performance Index (CPI)',
}

/** Live KPI card titles by metric key (overrides baked-in title_fa when present). */
export const KPI_TITLE_COPY = makeLiveCopy({
  fa: TITLE_FA,
  en: TITLE_EN as unknown as typeof TITLE_FA,
})

const UNIT_FA: Record<string, string> = {
  ضریب: 'ضریب',
  درصد: 'درصد',
  روز: 'روز',
  هفته: 'هفته',
  ماه: 'ماه',
}

const UNIT_EN: Record<string, string> = {
  ضریب: 'index',
  درصد: '%',
  روز: 'days',
  هفته: 'weeks',
  ماه: 'months',
}

export const KPI_UNIT_COPY = makeLiveCopy({
  fa: UNIT_FA,
  en: UNIT_EN as unknown as typeof UNIT_FA,
})

export function localizeKpiTitle(key: string, fallback: string): string {
  return KPI_TITLE_COPY[key] ?? fallback
}

export function localizeKpiUnit(unit: string): string {
  return KPI_UNIT_COPY[unit] ?? unit
}
