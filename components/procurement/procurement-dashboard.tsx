'use client'

import { useCallback, useEffect, useState } from 'react'
import { Package, ShoppingCart, Truck, Clock, CheckCircle2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { PageHeader, LoadingBlock, ErrorBlock, SectionCard, EmptyState } from '@/components/admin/shared'
import { StatCard } from '@/components/admin/stat-card'
import { AiDraftViewer } from '@/components/shared/ai-draft-viewer'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { useSupabase } from '@/hooks/useSupabase'
import { getProcurementMessages, STATUS_LABELS, procurementAiLabels } from '@/lib/i18n/procurement'
import type { ProcurementKpis, ProcurementRequest, ProcurementStatus } from '@/lib/procurement/types'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import type { DashboardUserContext } from '@/types/dashboard'
import { loadProcurementDashboard, updateProcurementStatus } from '@/utils/procurement/dashboard'
import { cn } from '@/lib/utils'
import {
  UiBlockCustomizePanel,
  UiBlockGuard,
  UiBlockVisibilityProvider,
} from '@/components/dashboard/ui-block-visibility'

interface ProcurementDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  visibleBlockCodes?: string[]
}

function nextStatus(current: ProcurementStatus): ProcurementStatus | null {
  const flow: ProcurementStatus[] = ['pending', 'sourcing', 'rfq_sent', 'po_issued', 'in_transit', 'received']
  const i = flow.indexOf(current)
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
}

export function ProcurementDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  visibleBlockCodes = [],
}: ProcurementDashboardProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getProcurementMessages(locale)
  const aiLabels = procurementAiLabels(t)
  const isRtl = dir === 'rtl'

  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [kpis, setKpis] = useState<ProcurementKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ProcurementRequest | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!projectId) {
      setRequests([])
      setKpis(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadProcurementDashboard(supabase, projectId)
      setRequests(data.requests)
      setKpis(data.kpis)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase, t.loadError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function advanceStatus(req: ProcurementRequest) {
    const next = nextStatus(req.status)
    if (!next) return
    setActionId(req.id)
    try {
      await updateProcurementStatus(supabase, req.aiActionId, next)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setActionId(null)
    }
  }

  function statusLabel(status: ProcurementStatus): string {
    const key = STATUS_LABELS[status]
    return key ? t[key] : status
  }

  function actionLabel(status: ProcurementStatus): string | null {
    if (status === 'pending') return t.startSourcing
    if (status === 'sourcing') return t.sendRfq
    if (status === 'rfq_sent') return t.issuePo
    if (status === 'po_issued') return t.markReceived
    if (status === 'in_transit') return t.markReceived
    return null
  }

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={t.title}
        description="از ادمین بخواهید شما را به‌عنوان مسئول تدارکات روی یک پروژه منصوب کند."
      />
    )
  }

  const k = kpis ?? {
    pendingRequests: 0,
    activeRfqs: 0,
    posInTransit: 0,
    delayedDeliveries: 0,
    receivedThisWeek: 0,
  }

  return (
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={initialContext.isSystemAdmin}
      dashboard="procurement"
      projectId={projectId}
    >
    <div className={cn('space-y-8', isRtl && 'text-right')}>
      <UiBlockCustomizePanel />

      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          projectOptions.length > 1 ? (
            <Select value={projectId ?? undefined} onValueChange={(id) => { setProjectId(id); writeProjectCookie(id) }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t.selectProject} />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      {loading && !kpis ? <LoadingBlock label={t.saving} /> : null}
      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      <UiBlockGuard code="PR-KPI-01">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t.pendingRequests} value={k.pendingRequests} icon={ShoppingCart} />
        <StatCard label={t.activeRfqs} value={k.activeRfqs} icon={Package} />
        <StatCard label={t.inTransit} value={k.posInTransit} icon={Truck} />
        <StatCard label={t.delayed} value={k.delayedDeliveries} icon={Clock} trendType={k.delayedDeliveries > 0 ? 'warning' : 'neutral'} />
        <StatCard label={t.receivedWeek} value={k.receivedThisWeek} icon={CheckCircle2} trendType="up" />
      </div>
      </UiBlockGuard>

      <UiBlockGuard code="PR-TBL-01">
      <SectionCard title={t.incomingRequests}>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t.noRequests}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full text-sm', isRtl && 'text-right')}>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-3 text-start">{t.material}</th>
                  <th className="py-2 px-3 text-start">{t.quantity}</th>
                  <th className="py-2 px-3 text-start">{t.neededDate}</th>
                  <th className="py-2 px-3 text-start">{t.priority}</th>
                  <th className="py-2 px-3 text-start">{t.status}</th>
                  <th className="py-2 px-3 text-end">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((req) => {
                  const act = actionLabel(req.status)
                  return (
                    <tr key={req.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-medium">{req.materialName}</td>
                      <td className="py-3 px-3">{req.quantity} {req.unit}</td>
                      <td className="py-3 px-3"><FormattedDate value={req.neededDate} /></td>
                      <td className="py-3 px-3"><Badge variant="outline">{req.priority}</Badge></td>
                      <td className="py-3 px-3"><Badge variant="secondary">{statusLabel(req.status)}</Badge></td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(req)}>{t.viewText}</Button>
                          {act && req.status !== 'received' ? (
                            <Button type="button" size="sm" variant="outline" disabled={actionId === req.id} onClick={() => void advanceStatus(req)}>
                              {act}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      </UiBlockGuard>

      <ModalOverlay open={!!selected} onClose={() => setSelected(null)} title={selected?.materialName ?? t.formalRequest}>
        {selected ? (
          <AiDraftViewer
            text={selected.formalText}
            status="confirmed_by_user"
            labels={aiLabels}
            showActions={false}
          />
        ) : null}
        <Button type="button" className="w-full mt-4" variant="outline" onClick={() => setSelected(null)}>{t.close}</Button>
      </ModalOverlay>
    </div>
    </UiBlockVisibilityProvider>
  )
}
