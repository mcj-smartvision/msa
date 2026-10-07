import type { SupabaseClient } from '@supabase/supabase-js'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { loadHolidays } from '@/features/holidays/lib/load-holidays'
import { holidayFromRow, HOLIDAY_TYPE_LABELS, type Holiday, type HolidayInput, type HolidayType } from '@/features/holidays/lib/types'
import { persistProgressForecast } from '@/features/schedule/lib/persist-progress-forecast'
import { createServiceClient } from '@/shared/lib/supabase/service'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function canManageHolidays(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_manage_holidays')
  if (error) throw new Error(error.message)
  return data === true
}

async function assertCanManage(supabase: SupabaseClient) {
  if (!(await canManageHolidays(supabase))) {
    throw new SiteOpsError('FORBIDDEN', 'ثبت و ویرایش تعطیلات فقط برای ادمین و مدیر پروژه مجاز است')
  }
}

export function parseHolidayInput(body: unknown): HolidayInput {
  const b = (body ?? {}) as Record<string, unknown>
  const type = b.type as HolidayType
  if (!(type in HOLIDAY_TYPE_LABELS)) throw new SiteOpsError('VALIDATION', 'نوع تعطیلی نامعتبر است')
  const startDate = typeof b.startDate === 'string' ? b.startDate : ''
  if (!ISO_DATE.test(startDate)) throw new SiteOpsError('VALIDATION', 'تاریخ شروع لازم است')
  const endDate = typeof b.endDate === 'string' && b.endDate ? b.endDate : null
  if (endDate && (!ISO_DATE.test(endDate) || endDate < startDate)) {
    throw new SiteOpsError('VALIDATION', 'تاریخ پایان نباید پیش از تاریخ شروع باشد')
  }
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) throw new SiteOpsError('VALIDATION', 'عنوان تعطیلی لازم است')
  const description = typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null
  return { type, startDate, endDate, title, description, isActive: b.isActive !== false }
}

const toRow = (input: Partial<HolidayInput>) => ({
  ...(input.type !== undefined && { type: input.type }),
  ...(input.startDate !== undefined && { start_date: input.startDate }),
  ...(input.endDate !== undefined && { end_date: input.endDate }),
  ...(input.title !== undefined && { title: input.title }),
  ...(input.description !== undefined && { description: input.description }),
  ...(input.isActive !== undefined && { is_active: input.isActive }),
})

/** Holidays move every project's working days, so each project's forecast is redone. */
async function refreshAllForecasts() {
  const service = createServiceClient()
  const { data: projects, error } = await service.from('projects').select('id')
  if (error) throw new Error(error.message)
  for (const p of projects ?? []) {
    try {
      await persistProgressForecast(service, String(p.id))
    } catch (err) {
      console.error('[holidays] forecast refresh failed', p.id, err)
    }
  }
}

export async function listHolidays(supabase: SupabaseClient): Promise<{ holidays: Holiday[]; canManage: boolean }> {
  const [holidays, canManage] = await Promise.all([loadHolidays(supabase), canManageHolidays(supabase)])
  return { holidays, canManage }
}

export async function createHoliday(supabase: SupabaseClient, input: HolidayInput): Promise<Holiday> {
  await assertCanManage(supabase)
  const { data, error } = await supabase.from('holidays').insert(toRow(input)).select('*').single()
  if (error) throw new Error(error.message)
  await refreshAllForecasts()
  return holidayFromRow(data as Record<string, unknown>)
}

export async function updateHoliday(supabase: SupabaseClient, id: string, input: Partial<HolidayInput>): Promise<Holiday> {
  await assertCanManage(supabase)
  const { data, error } = await supabase.from('holidays').update(toRow(input)).eq('id', id).select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new SiteOpsError('NOT_FOUND', 'تعطیلی پیدا نشد')
  await refreshAllForecasts()
  return holidayFromRow(data as Record<string, unknown>)
}

export async function deleteHoliday(supabase: SupabaseClient, id: string): Promise<void> {
  await assertCanManage(supabase)
  const { error } = await supabase.from('holidays').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await refreshAllForecasts()
}
