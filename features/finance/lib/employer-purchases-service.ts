import type { SupabaseClient } from '@supabase/supabase-js'
import { compareWbs } from '@/features/schedule/lib/wbs-utils'
import { WorkshopError } from '@/features/workshop/lib/domain'
import { workshopErrorResponse } from '@/features/workshop/lib/service'
import {
  employerPurchaseFromRow,
  PurchaseValidationError,
  type EmployerPurchase,
  type EmployerPurchaseInput,
  type PurchaseTaskOption,
} from '@/features/finance/lib/employer-purchases'

const SELECT = '*, employer_purchase_allocations(task_id, task_wbs, task_name, share_percent)'

/** Form mistakes answer 400 with their Persian message. */
export function purchaseErrorResponse(error: unknown) {
  return workshopErrorResponse(error instanceof PurchaseValidationError ? new WorkshopError('VALIDATION', error.message) : error)
}

/** Schedule activities (not headings) a purchase can be shared to, in WBS order. */
export async function listPurchaseTaskOptions(supabase: SupabaseClient, projectId: string): Promise<PurchaseTaskOption[]> {
  const { data, error } = await supabase
    .from('project_tasks')
    .select('id, wbs_code, name, is_summary')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { id: string; wbs_code: string | null; name: string | null; is_summary: boolean | null }[]
  const codes = rows.map((r) => r.wbs_code?.trim()).filter((c): c is string => !!c)
  return rows
    .filter((r) => {
      if (r.is_summary) return false
      const wbs = r.wbs_code?.trim()
      return !wbs || !codes.some((c) => c.startsWith(`${wbs}.`))
    })
    .map((r) => ({ id: String(r.id), wbs: r.wbs_code?.trim() || null, name: r.name?.trim() || 'بدون نام' }))
    .sort((a, b) => compareWbs(a.wbs, b.wbs))
}

export async function listEmployerPurchases(supabase: SupabaseClient, projectId: string): Promise<EmployerPurchase[]> {
  const { data, error } = await supabase
    .from('employer_purchases')
    .select(SELECT)
    .eq('project_id', projectId)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(employerPurchaseFromRow)
}

function purchaseRow(input: EmployerPurchaseInput) {
  return {
    purchase_date: input.purchaseDate,
    item_name: input.itemName,
    supplier: input.supplier,
    quantity: input.quantity,
    unit: input.unit,
    unit_price: input.unitPrice,
    amount: input.amount,
    invoice_ref: input.invoiceRef,
    description: input.description,
  }
}

/** Allocation rows with each activity's WBS and name kept, after checking every activity is in the project. */
async function allocationRows(supabase: SupabaseClient, projectId: string, purchaseId: string, input: EmployerPurchaseInput) {
  const options = new Map((await listPurchaseTaskOptions(supabase, projectId)).map((o) => [o.id, o]))
  return input.allocations.map((a) => {
    const task = options.get(a.taskId)
    if (!task) throw new PurchaseValidationError('یکی از آیتم‌های انتخاب‌شده در برنامهٔ این پروژه نیست')
    return {
      purchase_id: purchaseId,
      project_id: projectId,
      task_id: task.id,
      task_wbs: task.wbs,
      task_name: task.name,
      share_percent: a.sharePercent,
    }
  })
}

export async function createEmployerPurchase(supabase: SupabaseClient, projectId: string, input: EmployerPurchaseInput): Promise<string> {
  const { data, error } = await supabase
    .from('employer_purchases')
    .insert({ project_id: projectId, ...purchaseRow(input) })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const id = String(data.id)
  try {
    const rows = await allocationRows(supabase, projectId, id, input)
    const { error: allocError } = await supabase.from('employer_purchase_allocations').insert(rows)
    if (allocError) throw new Error(allocError.message)
  } catch (err) {
    await supabase.from('employer_purchases').delete().eq('id', id)
    throw err
  }
  return id
}

export async function updateEmployerPurchase(
  supabase: SupabaseClient,
  projectId: string,
  id: string,
  input: EmployerPurchaseInput
): Promise<void> {
  const rows = await allocationRows(supabase, projectId, id, input)
  const { data, error } = await supabase
    .from('employer_purchases')
    .update({ ...purchaseRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('project_id', projectId)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new PurchaseValidationError('خرید پیدا نشد')
  const { error: deleteError } = await supabase.from('employer_purchase_allocations').delete().eq('purchase_id', id)
  if (deleteError) throw new Error(deleteError.message)
  const { error: insertError } = await supabase.from('employer_purchase_allocations').insert(rows)
  if (insertError) throw new Error(insertError.message)
}

export async function deleteEmployerPurchase(supabase: SupabaseClient, projectId: string, id: string): Promise<void> {
  const { error } = await supabase.from('employer_purchases').delete().eq('id', id).eq('project_id', projectId)
  if (error) throw new Error(error.message)
}
