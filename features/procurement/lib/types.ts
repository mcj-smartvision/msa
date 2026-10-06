import type { PurchaseRequestPayload } from '@/features/supervisor/lib/types'

export type ProcurementStatus =
  | 'pending'
  | 'sourcing'
  | 'rfq_sent'
  | 'po_issued'
  | 'in_transit'
  | 'received'
  | 'cancelled'

export interface ProcurementRequest {
  id: string
  aiActionId: string
  projectId: string
  materialName: string
  quantity: number
  unit: string
  neededDate: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  sourceDepartment: string
  status: ProcurementStatus
  formalText: string
  payload: PurchaseRequestPayload & Record<string, unknown>
  createdAt: string
}

export interface ProcurementKpis {
  pendingRequests: number
  activeRfqs: number
  posInTransit: number
  delayedDeliveries: number
  receivedThisWeek: number
}

export interface PurchaseOrderRow {
  id: string
  requestId: string
  poNumber: string
  supplierName: string
  totalPrice: number
  status: ProcurementStatus
  issueDate: string
  expectedDeliveryDate: string
  trackingNumber?: string
}

export function aiActionToProcurementRequest(row: {
  id: string
  project_id: string
  payload: Record<string, unknown>
  text_generated: string
  procurement_status?: string
  created_at: string
}): ProcurementRequest | null {
  const payload = row.payload as unknown as PurchaseRequestPayload
  if (!payload.material_name) return null

  const rawStatus = row.procurement_status ?? 'pending'
  if (rawStatus === 'not_applicable' || rawStatus === 'cancelled') return null
  const status = rawStatus as ProcurementStatus

  return {
    id: row.id,
    aiActionId: row.id,
    projectId: row.project_id,
    materialName: payload.material_name,
    quantity: Number(payload.quantity) || 0,
    unit: payload.unit ?? 'عدد',
    neededDate: payload.needed_date ?? row.created_at.slice(0, 10),
    priority:
      payload.priority === 'critical'
        ? 'critical'
        : payload.priority === 'urgent'
          ? 'high'
          : 'medium',
    sourceDepartment: 'Site → PM Approved',
    status,
    formalText: row.text_generated,
    payload: { ...payload },
    createdAt: row.created_at,
  }
}

export function computeProcurementKpis(requests: ProcurementRequest[]): ProcurementKpis {
  return {
    pendingRequests: requests.filter((r) => r.status === 'pending').length,
    activeRfqs: requests.filter((r) => r.status === 'rfq_sent' || r.status === 'sourcing').length,
    posInTransit: requests.filter((r) => r.status === 'po_issued' || r.status === 'in_transit').length,
    delayedDeliveries: requests.filter((r) => {
      const today = new Date().toISOString().slice(0, 10)
      return r.neededDate < today && r.status !== 'received'
    }).length,
    receivedThisWeek: requests.filter((r) => r.status === 'received').length,
  }
}
