import type { SupabaseClient } from '@supabase/supabase-js'
import type {
ProcurementKpis,
ProcurementRequest,
ProcurementStatus,
} from '@/features/procurement/lib/types'
import { aiActionToProcurementRequest, computeProcurementKpis } from '@/features/procurement/lib/types'
import type { AiActionRow } from '@/features/supervisor/lib/types'
import { generateAiActionText } from '@/features/supervisor/lib/ai-generator'

export async function fetchProcurementRequests(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProcurementRequest[]> {
  const { data, error } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('project_id', projectId)
    .eq('type', 'purchase_request')
    .eq('pm_status', 'approved')
    .neq('procurement_status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? [])
    .map((row) => aiActionToProcurementRequest(row as AiActionRow))
    .filter(Boolean) as ProcurementRequest[]
}

export async function updateProcurementStatus(
  supabase: SupabaseClient,
  actionId: string,
  status: ProcurementStatus
): Promise<void> {
  const { error } = await supabase
    .from('ai_actions')
    .update({ procurement_status: status })
    .eq('id', actionId)
    .eq('type', 'purchase_request')

  if (error) throw new Error(error.message)
}

export async function generateQuoteAnalysisDraft(
  supabase: SupabaseClient,
  actionId: string,
  quotes: { supplier: string; price: number; days: number }[],
  locale: 'fa' | 'en' = 'fa'
): Promise<string> {
  const text = await generateAiActionText(
    'purchase_request',
    {
      material_name: 'Quote comparison',
      analysis: quotes.map((q) => `${q.supplier}: ${q.price} / ${q.days} days`).join('\n'),
    },
    locale
  )

  await supabase
    .from('ai_actions')
    .update({
      payload: { quote_analysis_draft: text, quotes },
    })
    .eq('id', actionId)

  return `[AI Draft — requires approval]\n${text}`
}

export async function loadProcurementDashboard(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ requests: ProcurementRequest[]; kpis: ProcurementKpis }> {
  const requests = await fetchProcurementRequests(supabase, projectId)
  const kpis = computeProcurementKpis(requests)
  return { requests, kpis }
}
