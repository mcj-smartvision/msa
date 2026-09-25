import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateContractInput,
  CreateSubcontractorInput,
  ProjectSubcontractor,
  SubcontractorContract,
} from '@/lib/project-manager/subcontractor-types'

export async function fetchProjectSubcontractors(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectSubcontractor[]> {
  const { data, error } = await supabase
    .from('project_subcontractors')
    .select('*, contracts:subcontractor_contracts(*)')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) {
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const r = row as ProjectSubcontractor & { contracts?: SubcontractorContract[] }
    return {
      ...r,
      contracts: Array.isArray(r.contracts) ? r.contracts : [],
    }
  })
}

export async function countActiveSubcontractors(
  supabase: SupabaseClient,
  projectId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('project_subcontractors')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('is_active', true)

  if (error) {
    if (error.code === '42P01') return 0
    return 0
  }
  return count ?? 0
}

export async function createSubcontractor(
  supabase: SupabaseClient,
  input: CreateSubcontractorInput
): Promise<ProjectSubcontractor> {
  const { data, error } = await supabase
    .from('project_subcontractors')
    .insert({
      project_id: input.projectId,
      name: input.name.trim(),
      trade: input.trade?.trim() || null,
      contact_name: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      national_id: input.nationalId?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return { ...(data as ProjectSubcontractor), contracts: [] }
}

export async function updateSubcontractorIdentity(
  supabase: SupabaseClient,
  input: {
    projectId: string
    subcontractorId: string
    name: string
    contactName: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('project_subcontractors')
    .update({
      name: input.name.trim(),
      contact_name: input.contactName.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.subcontractorId)
    .eq('project_id', input.projectId)
  if (error) throw new Error(error.message)
}

export async function updateSubcontractorContractIdentity(
  supabase: SupabaseClient,
  input: {
    projectId: string
    contractId: string
    contractNo: string
    startDate: string
    title: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('subcontractor_contracts')
    .update({
      contract_no: input.contractNo.trim(),
      start_date: input.startDate,
      title: input.title.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.contractId)
    .eq('project_id', input.projectId)
  if (error) throw new Error(error.message)
}

export async function createSubcontractorContract(
  supabase: SupabaseClient,
  input: CreateContractInput
): Promise<SubcontractorContract> {
  const { data, error } = await supabase
    .from('subcontractor_contracts')
    .insert({
      project_id: input.projectId,
      subcontractor_id: input.subcontractorId,
      contract_no: input.contractNo?.trim() || null,
      title: input.title?.trim() || 'قرارداد پیمانکاری',
      scope_summary: input.scopeSummary?.trim() || null,
      contract_value: input.contractValue ?? null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      retention_percent: input.retentionPercent ?? 10,
      payment_terms: input.paymentTerms?.trim() || null,
      standards_notes: input.standardsNotes?.trim() || null,
      status: input.status ?? 'draft',
      created_by: input.createdBy ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SubcontractorContract
}

export async function uploadContractFile(
  supabase: SupabaseClient,
  params: {
    projectId: string
    contractId: string
    file: File
  }
): Promise<SubcontractorContract> {
  const ext = params.file.name.split('.').pop() || 'pdf'
  const path = `${params.projectId}/${params.contractId}.${ext}`

  const { error: upError } = await supabase.storage
    .from('subcontractor-contracts')
    .upload(path, params.file, { upsert: true, contentType: params.file.type || undefined })

  if (upError) throw new Error(upError.message)

  const { data, error } = await supabase
    .from('subcontractor_contracts')
    .update({
      storage_path: path,
      storage_bucket: 'subcontractor-contracts',
      file_name: params.file.name,
      file_type: params.file.type || null,
      file_size: params.file.size,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.contractId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as SubcontractorContract
}

export async function assignSubcontractorToAiAction(
  supabase: SupabaseClient,
  actionId: string,
  subcontractorId: string
): Promise<void> {
  const { error } = await supabase
    .from('ai_actions')
    .update({ subcontractor_id: subcontractorId })
    .eq('id', actionId)

  if (error) {
    if (error.code === '42703') return // column not migrated yet
    throw new Error(error.message)
  }
}

export async function assignSubcontractorToTask(
  supabase: SupabaseClient,
  taskId: string,
  subcontractorId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('project_tasks')
    .update({ subcontractor_id: subcontractorId })
    .eq('id', taskId)

  if (error) {
    if (error.code === '42703') return
    throw new Error(error.message)
  }
}
