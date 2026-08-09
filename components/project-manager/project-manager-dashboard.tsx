'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/i18n/locale-provider'
import { PageHeader, EmptyState, LoadingBlock, ErrorBlock, SectionCard } from '@/components/admin/shared'
import { ScheduleDateToolbar } from '@/components/schedule/schedule-date-toolbar'
import { AiDraftViewer } from '@/components/shared/ai-draft-viewer'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import { PmAnalyticsControlRoom } from '@/components/project-manager/pm-analytics-control-room'
import { ApprovalCenter, DepartmentOverviewGrid, ActivityFeedPanel } from '@/components/project-manager/pm-sections'
import { ProposedChangeView } from '@/components/workshop/proposed-change-view'
import { UiBlockGuard, UiBlockVisibilityProvider, UiBlockCustomizePanel } from '@/components/dashboard/ui-block-visibility'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useSupabase } from '@/hooks/useSupabase'
import {
  getProjectManagerMessages,
  pmAiLabelsForItem,
  pmApprovalTitle,
} from '@/lib/i18n/project-manager'
import type { ApprovalItem, ProjectManagerDashboardData } from '@/lib/project-manager/types'
import type { ProjectSubcontractor } from '@/lib/project-manager/subcontractor-types'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import type { DashboardUserContext } from '@/types/dashboard'
import type { ProjectAlert, ProjectScheduleSummary, SiteDailyReport } from '@/types/schedule'
import {
  approveDailyReport,
  fetchProjectScheduleSummary,
  fetchRecentDailyReports,
  fetchUnresolvedAlerts,
} from '@/utils/schedule'
import {
  approvePmAiAction,
  loadProjectManagerDashboard,
  rejectPmAiAction,
} from '@/utils/project-manager/dashboard'
import { fetchProjectSubcontractors } from '@/utils/project-manager/subcontractors'
import { PmSubcontractorsPanel } from '@/components/project-manager/pm-subcontractors-panel'
import { PmWeeklySafetySummaryPanel } from '@/components/hse/pm-weekly-safety-summary'
import { VoiceToTextButton } from '@/components/shared/voice-to-text-button'
import { cn } from '@/lib/utils'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

interface ProjectManagerDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  initialSummary: ProjectScheduleSummary
  initialReports: SiteDailyReport[]
  initialAlerts: ProjectAlert[]
  visibleBlockCodes?: string[]
}

export function ProjectManagerDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  initialSummary,
  initialReports,
  initialAlerts,
  visibleBlockCodes = [],
}: ProjectManagerDashboardProps) {
  const supabase = useSupabase()
  const router = useRouter()
  const { locale, dir } = useLocale()
  const t = getProjectManagerMessages(locale)
  const isRtl = dir === 'rtl'

  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [data, setData] = useState<ProjectManagerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ApprovalItem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [subcontractors, setSubcontractors] = useState<ProjectSubcontractor[]>([])
  const [selectedSubId, setSelectedSubId] = useState<string>('')
  const isFa = locale === 'fa' || locale === 'ar'

  const loadData = useCallback(async () => {
    if (!projectId) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const useInitial = projectId === initialProjectId
      const [summary, reports, alerts] = useInitial
        ? [initialSummary, initialReports, initialAlerts]
        : await Promise.all([
            fetchProjectScheduleSummary(supabase, projectId),
            fetchRecentDailyReports(supabase, projectId),
            fetchUnresolvedAlerts(supabase, projectId),
          ])
      const result = await loadProjectManagerDashboard(
        supabase,
        projectId,
        summary,
        reports,
        alerts
      )
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [
    projectId,
    supabase,
    initialProjectId,
    initialSummary,
    initialReports,
    initialAlerts,
    t.loadError,
  ])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function handleProjectChange(id: string) {
    setProjectId(id)
    writeProjectCookie(id)
  }

  async function openApproval(item: ApprovalItem) {
    setSelected(item)
    setRejectReason('')
    setSelectedSubId('')
    if (item.type === 'subcontractor_instruction' && projectId) {
      try {
        const list = await fetchProjectSubcontractors(supabase, projectId)
        setSubcontractors(list.filter((s) => s.is_active))
        if (list.length === 1) setSelectedSubId(list[0].id)
      } catch {
        setSubcontractors([])
      }
    } else {
      setSubcontractors([])
    }
  }

  async function handleApproveItem(item: ApprovalItem, editedText: string) {
    setActionLoading(true)
    setLoadingId(item.id)
    try {
      if (item.kind === 'workshop_package') {
        const path =
          item.type === 'workshop_change'
            ? `/api/workshop/packages/${item.id}/change-decide`
            : `/api/workshop/packages/${item.id}/approve`
        const body =
          item.type === 'workshop_change'
            ? { decision: 'approve', comment: rejectReason || editedText || null }
            : { comment: rejectReason || editedText || null }
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t.loadError)
      } else if (item.kind === 'ai_action') {
        if (item.type === 'subcontractor_instruction') {
          if (subcontractors.length === 0) {
            throw new Error(
              isFa
                ? 'هنوز پیمانکاری معرفی نشده. ابتدا از بخش پیمانکاران ثبت کنید.'
                : 'No subcontractor registered. Add one first.'
            )
          }
          if (!selectedSubId) {
            throw new Error(
              isFa ? 'لطفاً پیمانکار مقصد را انتخاب کنید.' : 'Select the destination subcontractor.'
            )
          }
        }
        await approvePmAiAction(supabase, item.id, initialContext.userId, editedText, {
          subcontractorId: item.type === 'subcontractor_instruction' ? selectedSubId : null,
        })
      } else {
        await approveDailyReport(supabase, item.id, initialContext.userId)
      }
      setSelected(null)
      setRejectReason('')
      router.refresh()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setActionLoading(false)
      setLoadingId(null)
    }
  }

  async function handleRejectItem(item: ApprovalItem) {
    setActionLoading(true)
    setLoadingId(item.id)
    try {
      if (item.kind === 'workshop_package') {
        const path =
          item.type === 'workshop_change'
            ? `/api/workshop/packages/${item.id}/change-decide`
            : `/api/workshop/packages/${item.id}/reject`
        const body =
          item.type === 'workshop_change'
            ? { decision: 'reject', comment: rejectReason }
            : { comment: rejectReason }
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t.loadError)
      } else if (item.kind === 'ai_action') {
        await rejectPmAiAction(supabase, item.id, initialContext.userId, rejectReason || undefined)
      }
      setSelected(null)
      setRejectReason('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setActionLoading(false)
      setLoadingId(null)
    }
  }

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={t.title}
        description="از ادمین بخواهید شما را به‌عنوان مدیر پروژه روی یک پروژه منصوب کند."
      />
    )
  }

  const health: ProjectManagerDashboardData['health'] = data?.health ?? {
    plannedProgress: initialSummary.overallPercentComplete + 5,
    actualProgress: initialSummary.overallPercentComplete,
    scheduleDelayDays: initialSummary.delayedTasks > 0 ? (initialSummary.delayedTasks > 5 ? 3 : 1) : 0,
    criticalDelayedActivities: initialSummary.criticalTasks,
    pendingApprovals: 0,
    shortageMaterials: 0,
    shortageManpower: initialSummary.delayedTasks > 3 ? 1 : 0,
    activeQcIssues: 0,
    activeHseAlerts: initialAlerts.length,
    riskLevel: initialSummary.delayedTasks > 5 ? 'high' : initialSummary.delayedTasks > 0 ? 'medium' : 'low',
  }

  const projectName =
    projectOptions.find((p) => p.id === projectId)?.name ?? projectOptions[0]?.name ?? 'Project'

  return (
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={initialContext.isSystemAdmin}
      dashboard="project-manager"
      projectId={projectId}
    >
      <div className={cn('space-y-8', isRtl && 'text-right')}>
        <UiBlockCustomizePanel />

        <PmAnalyticsControlRoom
          projectName={projectName}
          summary={data?.summary ?? initialSummary}
          health={health}
          alerts={initialAlerts}
          reports={data?.reports ?? initialReports}
          compliance={data?.compliance ?? null}
          dataGaps={data?.dataGaps ?? []}
          projectOptions={projectOptions}
          projectId={projectId}
          onProjectChange={handleProjectChange}
          isRtl={isRtl}
          isFa={locale === 'fa' || locale === 'ar'}
        />

        <PmWeeklySafetySummaryPanel />

        <UiBlockGuard code="PM-TBL-01">
          <div className="border-t pt-8 space-y-6">
            <PageHeader title={t.approvalCenter} description={t.description} />
            <ScheduleDateToolbar />

            {projectId ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 text-sm">
                  <p className="font-medium text-emerald-950">
                    {isFa ? 'تأییدات عملیات کارگاه (دفتر فنی)' : 'Workshop approvals (Technical Office)'}
                  </p>
                  <p className="text-emerald-900/80 mt-0.5">{t.workshopApprovalsHint}</p>
                </div>
                <Button type="button" size="sm" asChild>
                  <Link href={`/site-ops/approvals?projectId=${projectId}`}>
                    {t.workshopApprovalsLink}
                  </Link>
                </Button>
              </div>
            ) : null}

            {loading && !data ? <LoadingBlock label={t.saving} /> : null}
            {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ApprovalCenter
                  items={data?.approvals ?? []}
                  t={t}
                  isRtl={isRtl}
                  loadingId={loadingId}
                  onView={(item) => void openApproval(item)}
                />
              </div>
              <div className="space-y-6">
                {projectId ? (
                  <PmSubcontractorsPanel
                    projectId={projectId}
                    projectName={projectName}
                    userId={initialContext.userId}
                    compact
                  />
                ) : null}
                <UiBlockGuard code="PM-PNL-06">
                  <SectionCard title={t.criticalAlerts}>
                    {initialAlerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">{t.noAlerts}</p>
                    ) : (
                      <div className="space-y-2 p-4">
                        {initialAlerts.slice(0, 6).map((alert) => (
                          <div key={alert.id} className="rounded-lg border p-3 text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-amber-600" />
                              <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p>{alert.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </UiBlockGuard>
                <UiBlockGuard code="PM-PNL-07">
                  <ActivityFeedPanel items={data?.activity ?? []} t={t} />
                </UiBlockGuard>
              </div>
            </div>
          </div>
        </UiBlockGuard>

        <UiBlockGuard code="PM-PNL-08">
          <DepartmentOverviewGrid departments={data?.departments ?? []} t={t} />
        </UiBlockGuard>

      <ModalOverlay
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? pmApprovalTitle(selected.type, t) : t.approvalCenter}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">
                  {selected.kind === 'workshop_package' ? t.fromTechnicalOffice : t.fromSiteSupervisor}
                </span>
                {selected.description ? (
                  <>
                    <span className="mx-1.5 text-muted-foreground">·</span>
                    <span className="font-medium">{selected.description}</span>
                  </>
                ) : null}
              </p>
            </div>

            {selected.kind === 'workshop_package' && selected.raw?.pending_change ? (
              <ProposedChangeView
                isFa={isFa}
                current={{
                  name: selected.raw.name,
                  location: selected.raw.location,
                  quantity: selected.raw.quantity,
                  uom: selected.raw.uom,
                  crew: selected.raw.crew,
                  note: selected.raw.note,
                }}
                proposed={selected.raw.pending_change as Record<string, unknown>}
              />
            ) : null}

            {selected.type === 'subcontractor_instruction' ? (
              subcontractors.length === 0 ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-2">
                  <div className="flex gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {isFa
                      ? 'هنوز پیمانکاری معرفی نشده — ارسال ممکن نیست'
                      : 'No subcontractor registered — cannot send'}
                  </div>
                  <p className="text-xs leading-relaxed">
                    {isFa
                      ? 'ابتدا پیمانکار را در بخش «پیمانکاران پروژه» ثبت کنید، سپس دوباره این دستور را تأیید کنید.'
                      : 'Register a subcontractor in Project Subcontractors first, then approve again.'}
                  </p>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href="/project/subcontractors">
                      {isFa ? 'رفتن به معرفی پیمانکار' : 'Register subcontractor'}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>{isFa ? 'ارسال به کدام پیمانکار؟' : 'Send to which subcontractor?'}</Label>
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isFa ? 'انتخاب پیمانکار…' : 'Select subcontractor…'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {subcontractors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.trade ? ` — ${s.trade}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            ) : null}

            {selected.kind === 'workshop_package' ? (
              <div className="space-y-3">
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p className="font-medium">{String(selected.raw?.name ?? selected.title)}</p>
                  <p className="text-muted-foreground">{selected.description}</p>
                  {selected.raw?.note ? (
                    <p className="text-xs text-muted-foreground">
                      {isFa ? 'یادداشت:' : 'Note:'} {String(selected.raw.note)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    {isFa ? 'کامنت مدیر پروژه' : 'PM comment'}
                    {selected.type === 'workshop_package' || selected.type === 'workshop_change'
                      ? isFa
                        ? ' (برای رد الزامی)'
                        : ' (required to reject)'
                      : ''}
                  </label>
                  <Textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={isFa ? 'توضیح برای دفتر فنی…' : 'Note for Technical Office…'}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleApproveItem(selected, rejectReason)}
                  >
                    {isFa ? 'تأیید' : 'Approve'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={actionLoading || !rejectReason.trim()}
                    onClick={() => void handleRejectItem(selected)}
                  >
                    {isFa ? 'رد با کامنت' : 'Reject with comment'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <AiDraftViewer
                  text={selected.aiGeneratedText ?? selected.description}
                  status="draft_by_ai"
                  labels={{
                    ...pmAiLabelsForItem(t, selected.type, locale),
                    approveSend:
                      selected.type === 'subcontractor_instruction'
                        ? subcontractors.length === 0
                          ? isFa
                            ? 'ارسال ممکن نیست — پیمانکار نیست'
                            : 'Cannot send — no subcontractor'
                          : selectedSubId
                            ? `${isFa ? 'تأیید و ارسال به' : 'Approve & send to'} ${
                                subcontractors.find((s) => s.id === selectedSubId)?.name ?? ''
                              }`
                            : isFa
                              ? 'تأیید و ارسال به پیمانکار (انتخاب کنید)'
                              : 'Approve & send to subcontractor (select)'
                        : pmAiLabelsForItem(t, selected.type, locale).approveSend,
                  }}
                  forceShowActions
                  loading={actionLoading}
                  onApprove={
                    selected.type === 'subcontractor_instruction' &&
                    (subcontractors.length === 0 || !selectedSubId)
                      ? undefined
                      : (text) => handleApproveItem(selected, text)
                  }
                  onReject={() => handleRejectItem(selected)}
                />
                {selected.kind === 'ai_action' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-muted-foreground">{t.rejectionReason}</label>
                      <VoiceToTextButton
                        onTranscript={(text) =>
                          setRejectReason((prev) => (prev ? `${prev} ${text}` : text))
                        }
                      />
                    </div>
                    <Textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </ModalOverlay>
      </div>
    </UiBlockVisibilityProvider>
  )
}
