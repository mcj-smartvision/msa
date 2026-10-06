export type SubcontractStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface ProjectSubcontractor {
  id: string
  project_id: string
  name: string
  trade: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  national_id: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  contracts?: SubcontractorContract[]
}

export interface SubcontractorContract {
  id: string
  project_id: string
  subcontractor_id: string
  contract_no: string | null
  title: string
  scope_summary: string | null
  contract_value: number | null
  currency: string
  start_date: string | null
  end_date: string | null
  retention_percent: number | null
  payment_terms: string | null
  standards_notes: string | null
  status: SubcontractStatus
  storage_path: string | null
  storage_bucket: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateSubcontractorInput {
  projectId: string
  name: string
  trade?: string
  contactName?: string
  phone?: string
  email?: string
  nationalId?: string
  address?: string
  notes?: string
  createdBy?: string
}

export interface CreateContractInput {
  projectId: string
  subcontractorId: string
  contractNo?: string
  title?: string
  scopeSummary?: string
  contractValue?: number
  startDate?: string
  endDate?: string
  retentionPercent?: number
  paymentTerms?: string
  standardsNotes?: string
  status?: SubcontractStatus
  createdBy?: string
}
