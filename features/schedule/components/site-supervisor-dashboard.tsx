/**
 * @file features/schedule/components/site-supervisor-dashboard.tsx
 * @purpose کامپوننت UI — زمان‌بندی، WBS و گانت (site-supervisor-dashboard)
 * @safe-to-edit CAREFUL
 * @affects زمان‌بندی، WBS و گانت
 * @depends-on shared/components/i18n/locale-provider, features/admin/components/shared, features/supervisor/components/supervisor-drawings-zoning-panel, features/supervisor/components/daily-report-panel, features/supervisor/components/daily-report-background-panel, features/project-store/components/store-inspector, features/holidays/components/holidays-panel, features/schedule/components/schedule-date-input, features/supervisor/components/supervisor-overview-panel, features/supervisor/components/today-activities-table
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, Loader2 } from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { PageHeader, LoadingBlock, ErrorBlock, EmptyState } from '@/features/admin/components/shared'
import { SupervisorDrawingsZoningPanel } from '@/features/supervisor/components/supervisor-drawings-zoning-panel'
import { DailyReportPanel } from '@/features/supervisor/components/daily-report-panel'
import { DailyReportBackgroundPanel } from '@/features/supervisor/components/daily-report-background-panel'
import { StoreInspector } from '@/features/project-store/components/store-inspector'
import { WeeklyEvaluationCard } from '@/features/project-store/components/weekly-evaluation-card'
import { HolidaysPanel } from '@/features/holidays/components/holidays-panel'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { SupervisorOverviewPanel } from '@/features/supervisor/components/supervisor-overview-panel'
import { TodayActivitiesTable } from '@/features/supervisor/components/today-activities-table'
import { LookaheadPanel } from '@/features/supervisor/components/lookahead-panel'
import { ResourcesPanel } from '@/features/supervisor/components/resources-panel'
import { IssuesAlertsPanel } from '@/features/supervisor/components/issues-alerts-panel'
import {
SafetyAlertsPage,
countOpenSafetyAlertMocks,
openSafetyAlertsTitle,
} from '@/features/hse/components/safety-alerts-page'
import {
SupervisorWorkspaceShell,
type SupervisorNavId,
} from '@/features/supervisor/components/supervisor-workspace-shell'
import { QuickReportDialog } from '@/features/supervisor/components/quick-report-dialog'
import { PackageProgressDialog } from '@/features/supervisor/components/package-progress-dialog'
import { AiDraftViewer } from '@/shared/components/common/ai-draft-viewer'
import { ModalOverlay } from '@/features/supervisor/components/modal-overlay'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { useScheduleViewDate } from '@/features/schedule/hooks/use-schedule-view-date'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { getSiteSupervisorMessages } from '@/shared/lib/i18n/site-supervisor'
import { QcEnginePanels } from '@/features/qc/components/qc-engine-panels'
import { getQcMessages } from '@/shared/lib/i18n/qc'
import {
alertsToIssues,
buildResourceSummary,
tasksToLookahead,
tasksToTodayActivities,
} from '@/features/supervisor/lib/transforms'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { getSupervisorRouteCopy } from '@/shared/lib/common/ai-action-routing'
import type { AiDraftLabels } from '@/shared/lib/common/ai-types'
import type { AiActionRow, AiActionType, TodayActivity } from '@/features/supervisor/lib/types'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import type { ProjectAlert, ProjectTask } from '@/shared/types/schedule'
import { fetchAllProjectTasks, fetchUnresolvedAlerts } from '@/features/schedule/services/schedule'
import { fetchInventoryItems } from '@/features/storekeeper/services/inventory'
import {
confirmAiAction,
confirmDailyReportDraft,
createAiActionDraft,
fetchSupervisorAiDrafts,
rejectAiAction,
rejectDailyReportDraft,
submitQuickReport,
updateAiActionText,
} from '@/features/supervisor/services/dashboard'
import { cn } from '@/shared/lib/utils'
import { refreshProjectStore, storePercentOf, useStoreProgress } from '@/features/project-store/use-store-progress'
import { useWeather } from '@/features/weather/hooks/use-weather'
import { ensureWeatherLine, formatWeatherReportLine, weatherSnapshotFromPayload } from '@/features/weather/lib/report-stamp'

interface SiteSupervisorDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  initialTasks: ProjectTask[]
  initialAlerts: ProjectAlert[]
  initialSection?: SupervisorNavId
}

type ActionDialog = 'purchase' | 'pm_comment' | 'hse_alert' | 'instruction' | null

export function SiteSupervisorDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  initialTasks,
  initialAlerts,
  initialSection = 'daily-progress',
}: SiteSupervisorDashboardProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getSiteSupervisorMessages(locale)
  const isRtl = dir === 'rtl'
  const isFa = locale === 'fa' || locale === 'ar'
  const { viewDate } = useScheduleViewDate()

  function labelsForAction(type: AiActionType | 'daily_report'): AiDraftLabels {
    const route = getSupervisorRouteCopy(type, isFa ? 'fa' : 'en')
    return {
      draftByAi: t.draftByAi,
      confirmed: t.confirmed,
      approveSend: route.approveSend,
      editText: t.editText,
      reject: t.reject,
      regenerate: t.regenerate,
      saving: t.saving,
      whatIsThis: route.whatIsThis,
      destinationHint: route.destinationHint,
    }
  }

  const projectId = useSyncedProjectId(initialProjectId)
  const storeProgress = useStoreProgress(projectId)
  const { data: weather } = useWeather(projectId)
  const [tasks, setTasks] = useState(initialTasks)
  const [alerts, setAlerts] = useState(initialAlerts)
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof fetchInventoryItems>>>([])
  const [aiDrafts, setAiDrafts] = useState<AiActionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quickReportActivity, setQuickReportActivity] = useState<TodayActivity | null>(null)
  const [packageProgressActivity, setPackageProgressActivity] = useState<TodayActivity | null>(null)
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null)
  const [actionTaskId, setActionTaskId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [generatedAction, setGeneratedAction] = useState<AiActionRow | null>(null)

  // Form fields for action dialogs
  const [purchaseMaterial, setPurchaseMaterial] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('1')
  const [purchaseUnit, setPurchaseUnit] = useState(t.purchaseUnitDefault)
  const [purchaseDate, setPurchaseDate] = useState(viewDate)
  const [purchaseReason, setPurchaseReason] = useState('')
  const [pmCategory, setPmCategory] = useState('general')
  const [pmNote, setPmNote] = useState('')
  const [hseSeverity, setHseSeverity] = useState('warning')
  const [hseDesc, setHseDesc] = useState('')
  const [instructionText, setInstructionText] = useState('')
  const [activeSection, setActiveSection] = useState<SupervisorNavId>(initialSection)
  const [safetyBadge, setSafetyBadge] = useState(countOpenSafetyAlertMocks)
  const qcMessages = getQcMessages(locale)
  const inspectionDrawingsHref = `/dashboard/qc/drawings?returnTo=${encodeURIComponent('/dashboard/site-supervisor?section=inspection')}`

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('section') === 'inspection') setActiveSection('inspection')
  }, [])

  function selectSection(id: SupervisorNavId) {
    setActiveSection(id)
    const url = new URL(window.location.href)
    if (id === 'daily-progress') url.searchParams.delete('section')
    else url.searchParams.set('section', id)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  const loadData = useCallback(async () => {
    if (!projectId) {
      setTasks([])
      setAlerts([])
      setInventory([])
      setAiDrafts([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [taskRows, alertRows, invRows, drafts] = await Promise.all([
        fetchAllProjectTasks(supabase, projectId),
        fetchUnresolvedAlerts(supabase, projectId),
        fetchInventoryItems(supabase, projectId).catch(() => []),
        fetchSupervisorAiDrafts(supabase, projectId, initialContext.userId).catch(() => []),
      ])
      setTasks(taskRows)
      setAlerts(alertRows)
      setInventory(invRows)
      setAiDrafts(drafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase, initialContext.userId, t.loadError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  /** Same date filter as before: current window + incomplete overdue (not all unfinished tasks). */
  const todayActivities = useMemo(() => {
    const base = tasksToTodayActivities(tasks, viewDate, inventory)
    if (!storeProgress.ready) return base
    return base.map((a) => {
      const key = a.kind === 'package' ? `package:${a.packageId ?? a.id}` : `schedule:${a.id}`
      const percent = storePercentOf(storeProgress.percents, key, a.actual_progress_percent)
      if (percent == null) return a
      return {
        ...a,
        actual_progress_percent: percent,
        actual_status: percent >= 100 ? ('finished' as const) : a.actual_status,
      }
    })
  }, [tasks, viewDate, inventory, storeProgress.ready, storeProgress.percents])
  const scheduleTodayRows = todayActivities
  const lookahead = useMemo(() => tasksToLookahead(tasks, viewDate), [tasks, viewDate])
  const resources = useMemo(
    () => buildResourceSummary(inventory, todayActivities.length),
    [inventory, todayActivities.length]
  )
  const issues = useMemo(() => alertsToIssues(alerts, tasks), [alerts, tasks])

  async function handleCreateAction(type: ActionDialog) {
    if (!projectId || !type) return
    setActionLoading(true)
    try {
      let payload: Record<string, unknown> = {}
      if (type === 'purchase') {
        payload = {
          material_name: purchaseMaterial,
          quantity: Number(purchaseQty),
          unit: purchaseUnit,
          needed_date: purchaseDate,
          priority: 'normal',
          reason: purchaseReason,
        }
      } else if (type === 'pm_comment') {
        payload = { category: pmCategory, note: pmNote }
      } else if (type === 'hse_alert') {
        payload = { severity: hseSeverity, description: hseDesc }
      } else if (type === 'instruction') {
        const task = tasks.find((x) => x.id === actionTaskId)
        const todayRow = scheduleTodayRows.find((a) => a.id === actionTaskId)
        payload = {
          activity_name: task?.name ?? todayRow?.name ?? 'Activity',
          wbs_code: task?.wbs_code ?? todayRow?.wbs_code ?? '',
          subcontractor_name: todayRow?.subcontractor_name ?? '',
          instruction: instructionText,
          progress_percent: todayRow?.actual_progress_percent ?? task?.percent_complete ?? 0,
          planned_status: todayRow?.planned_status ?? '',
          is_critical: todayRow?.is_critical ?? task?.is_critical ?? false,
        }
      }

      const actionType =
        type === 'instruction'
          ? 'subcontractor_instruction'
          : type === 'purchase'
            ? 'purchase_request'
            : type

      const draft = await createAiActionDraft(supabase, {
        type: actionType,
        projectId,
        supervisorId: initialContext.userId,
        payload,
        relatedTaskId: actionTaskId ?? undefined,
        locale: locale === 'fa' ? 'fa' : 'en',
      })
      setGeneratedAction(draft)
      setAiDrafts((prev) => [draft, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : t.actionFailed)
    } finally {
      setActionLoading(false)
    }
  }

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={t.title}
        description={t.assignSupervisorHint}
      />
    )
  }

  return (
    <div className={cn('space-y-3 sm:space-y-6 lg:space-y-8', isRtl && 'text-right')}>
      <div className="lg:hidden">
        <h1 className="text-lg font-extrabold tracking-tight text-white drop-shadow-sm">{t.title}</h1>
      </div>
      <div className="hidden lg:block">
        <PageHeader title={t.title} description={t.description} />
      </div>

      {loading && tasks.length === 0 ? <LoadingBlock label={t.saving} /> : null}
      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      <SupervisorWorkspaceShell
        activeId={activeSection}
        onSelect={selectSection}
        items={[
          {
            id: 'daily-progress',
            label: t.navDailyProgress,
            hint: t.navDailyProgressHint,
          },
          {
            id: 'report-background',
            label: t.navReportBackground,
            hint: t.navReportBackgroundHint,
          },
          {
            id: 'daily-report',
            label: t.navDailyReport,
            hint: t.navDailyReportHint,
          },
          {
            id: 'weekly-commitments',
            label: t.navWeeklyCommitments,
            hint: t.navWeeklyCommitmentsHint,
          },
          {
            id: 'weekly-rnc',
            label: t.navWeeklyRnc,
            hint: t.navWeeklyRncHint,
          },
          {
            id: 'store',
            label: t.navStore,
            hint: t.navStoreHint,
          },
          {
            id: 'holidays',
            label: t.navHolidays,
            hint: t.navHolidaysHint,
          },
          {
            id: 'safety',
            label: t.navSafety,
            hint: t.navSafetyHint,
            badge: safetyBadge,
            badgeTone: 'danger',
            badgeTitle: openSafetyAlertsTitle(safetyBadge),
          },
          {
            id: 'overview',
            label: t.navOverview,
            hint: t.navOverviewHint,
          },
          {
            id: 'drawings',
            label: t.navDrawings,
            hint: t.navDrawingsHint,
          },
          {
            id: 'inspection',
            label: t.inspectionRequestNav,
            hint: t.inspectionRequestNavHint,
          },
          {
            id: 'today',
            label: t.todayActivities,
            hint: t.navTodayHint,
          },
          {
            id: 'lookahead',
            label: t.navLookahead,
            hint: t.navLookaheadHint,
          },
          {
            id: 'issues',
            label: t.issuesAlerts,
            hint: t.navIssuesHint,
            badge: issues.filter((i) => i.status === 'open').length || undefined,
          },
          {
            id: 'resources',
            label: t.navResources,
            hint: t.navResourcesHint,
          },
          {
            id: 'ai',
            label: t.navAi,
            hint: t.navAiHint,
            badge: aiDrafts.length || undefined,
          },
          {
            id: 'workshop',
            label: t.navWorkshop,
            hint: t.navWorkshopHint,
          },
        ]}
      >
        {activeSection === 'safety' ? (
          <SafetyAlertsPage
            embedded
            showSidebar={false}
            onQueueChange={setSafetyBadge}
          />
        ) : null}

        {activeSection === 'overview' ? (
          <SupervisorOverviewPanel
            projectId={projectId}
            onViewSafety={() => selectSection('safety')}
          />
        ) : null}

        {activeSection === 'drawings' ? (
          <SupervisorDrawingsZoningPanel projectId={projectId} />
        ) : null}

        {activeSection === 'inspection' ? (
          projectId ? (
            <QcEnginePanels
              projectId={projectId}
              t={qcMessages}
              showRequestForm
              showResults={false}
              drawingsHref={inspectionDrawingsHref}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t.selectProjectFirst}</p>
          )
        ) : null}

        {activeSection === 'workshop' ? (
          projectId ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{t.workshopIntro}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" asChild>
                  <Link
                    href={`/dashboard/technical-office?section=schedule&workshopTab=prepared&projectId=${projectId}&as=supervisor`}
                  >
                    {t.workshopListsCta}
                  </Link>
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link
                    href={`/dashboard/technical-office?section=schedule&workshopTab=schedule&projectId=${projectId}&as=supervisor`}
                  >
                    {t.viewScheduleReadOnly}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.selectProjectFirst}</p>
          )
        ) : null}

        {activeSection === 'daily-progress' || activeSection === 'daily-report' ? (
          <DailyReportPanel
            projectId={projectId}
            projectName={projectOptions.find((p) => p.id === projectId)?.name ?? ''}
            view={activeSection === 'daily-progress' ? 'progress' : 'note'}
          />
        ) : null}

        {activeSection === 'weekly-commitments' ? (
          <WeeklyEvaluationCard projectId={projectId} mode="commitments" />
        ) : null}

        {activeSection === 'weekly-rnc' ? (
          <WeeklyEvaluationCard projectId={projectId} mode="rnc" />
        ) : null}

        {activeSection === 'report-background' ? <DailyReportBackgroundPanel projectId={projectId} isAdmin={initialContext.isSystemAdmin} /> : null}

        {activeSection === 'store' ? <StoreInspector projectId={projectId} /> : null}

        {activeSection === 'holidays' ? <HolidaysPanel /> : null}

        {activeSection === 'today' ? (
            <TodayActivitiesTable
              activities={todayActivities}
              labels={t}
              isRtl={isRtl}
              onOpenQuickReport={(id) => {
                const act = todayActivities.find((a) => a.id === id && a.kind === 'schedule') ?? null
                setQuickReportActivity(act)
              }}
              onOpenPackageProgress={(id) => {
                const act = todayActivities.find((a) => a.id === id && a.kind === 'package') ?? null
                setPackageProgressActivity(act)
              }}
              onCreateInstruction={(id) => {
                setActionTaskId(id)
                setInstructionText('')
                setGeneratedAction(null)
                setActionDialog('instruction')
              }}
            />
        ) : null}

        {activeSection === 'lookahead' ? (
            <LookaheadPanel activities={lookahead} labels={t} isRtl={isRtl} />
        ) : null}

        {activeSection === 'issues' ? (
            <IssuesAlertsPanel
              issues={issues}
              labels={t}
              onDraftPmComment={(issueId) => {
                const issue = issues.find((i) => i.id === issueId)
                setPmNote(issue?.description ?? '')
                setGeneratedAction(null)
                setActionDialog('pm_comment')
              }}
            />
        ) : null}

        {activeSection === 'resources' ? (
            <ResourcesPanel
              resources={resources}
              labels={t}
              onRequestPurchase={() => {
                setGeneratedAction(null)
                setActionDialog('purchase')
              }}
            />
        ) : null}

        {activeSection === 'ai' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setGeneratedAction(null)
                    setActionDialog('hse_alert')
                  }}
                >
                  {t.hseAlert}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setGeneratedAction(null)
                    setActionDialog('pm_comment')
                  }}
                >
                  {t.pmComment}
                </Button>
              </div>
              {aiDrafts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.noAiDrafts}</p>
              ) : (
                <div className="space-y-4">
                  {aiDrafts.slice(0, 5).map((draft) => (
                    <div key={draft.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <Badge variant="outline">{draft.type}</Badge>
                      </div>
                      <AiDraftViewer
                        text={draft.text_generated}
                        status={draft.status}
                        labels={labelsForAction(draft.type)}
                        onApprove={async (text) => {
                          if (text !== draft.text_generated) {
                            await updateAiActionText(supabase, draft.id, text)
                          }
                          await confirmAiAction(supabase, draft.id, initialContext.userId)
                          void loadData()
                        }}
                        onReject={async () => {
                          await rejectAiAction(supabase, draft.id, initialContext.userId)
                          void loadData()
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
        ) : null}
      </SupervisorWorkspaceShell>

      <QuickReportDialog
        open={!!quickReportActivity}
        onClose={() => setQuickReportActivity(null)}
        activity={quickReportActivity}
        projectId={projectId ?? ''}
        supervisorId={initialContext.userId}
        viewDate={viewDate}
        labels={t}
        locale={locale === 'fa' ? 'fa' : 'en'}
        onSubmit={async (input) => {
          const line = weather ? formatWeatherReportLine(weather) : ''
          const stamped = {
            ...input,
            supervisorNote: line ? ensureWeatherLine(input.supervisorNote ?? '', line) : input.supervisorNote,
            weather: weather ? weatherSnapshotFromPayload(weather, input.date) : input.weather,
          }
          const { report, summaryText } = await submitQuickReport(supabase, stamped, locale === 'fa' ? 'fa' : 'en')
          refreshProjectStore()
          return { summaryText, reportId: report.id }
        }}
        onApproveReport={async (reportId, text) => {
          await confirmDailyReportDraft(supabase, reportId, initialContext.userId, text)
          void loadData()
        }}
        onRejectReport={async (reportId) => {
          await rejectDailyReportDraft(supabase, reportId, initialContext.userId)
        }}
      />

      <PackageProgressDialog
        open={!!packageProgressActivity}
        onClose={() => setPackageProgressActivity(null)}
        activity={packageProgressActivity}
        viewDate={viewDate}
        labels={t}
        locale={locale === 'fa' ? 'fa' : 'en'}
        onSaved={() => {
          refreshProjectStore()
          void loadData()
        }}
      />

      <ModalOverlay
        open={actionDialog !== null}
        onClose={() => {
          setActionDialog(null)
          setGeneratedAction(null)
        }}
        title={
          actionDialog === 'purchase'
            ? t.requestPurchase
            : actionDialog === 'pm_comment'
              ? t.pmComment
              : actionDialog === 'hse_alert'
                ? t.hseAlert
                : t.aiInstruction
        }
      >
        {!generatedAction ? (
          <div className="space-y-4">
            {actionDialog === 'purchase' ? (
              <>
                <div className="space-y-2">
                  <Label>{t.material}</Label>
                  <Input value={purchaseMaterial} onChange={(e) => setPurchaseMaterial(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t.qty}</Label>
                    <Input type="number" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.unit}</Label>
                    <Input value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} />
                  </div>
                </div>
                <ScheduleDateInput
                  label={t.neededDate}
                  valueIso={purchaseDate}
                  onChangeIso={setPurchaseDate}
                />
                <div className="space-y-2">
                  <Label>{t.reason}</Label>
                  <Textarea rows={3} value={purchaseReason} onChange={(e) => setPurchaseReason(e.target.value)} />
                </div>
              </>
            ) : null}
            {actionDialog === 'pm_comment' ? (
              <>
                <div className="space-y-2">
                  <Label>{t.category}</Label>
                  <Select value={pmCategory} onValueChange={setPmCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delay">{t.delayRisk}</SelectItem>
                      <SelectItem value="resource">{t.resourceCategory}</SelectItem>
                      <SelectItem value="coordination">{t.coordination}</SelectItem>
                      <SelectItem value="general">{t.general}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea rows={4} value={pmNote} onChange={(e) => setPmNote(e.target.value)} />
              </>
            ) : null}
            {actionDialog === 'hse_alert' ? (
              <>
                <Select value={hseSeverity} onValueChange={setHseSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">{t.info}</SelectItem>
                    <SelectItem value="warning">{t.warning}</SelectItem>
                    <SelectItem value="critical">{t.critical}</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea rows={4} value={hseDesc} onChange={(e) => setHseDesc(e.target.value)} />
              </>
            ) : null}
            {actionDialog === 'instruction' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed rounded-md border bg-muted/30 px-3 py-2">
                  {t.instructionHelp}
                </p>
                <div className="flex justify-end">
                  <VoiceToTextButton
                    onTranscript={(text) =>
                      setInstructionText((prev) => (prev ? `${prev}\n${text}` : text))
                    }
                  />
                </div>
                <Textarea
                  rows={5}
                  value={instructionText}
                  onChange={(e) => setInstructionText(e.target.value)}
                  placeholder={t.instructionPlaceholder}
                />
              </div>
            ) : null}
            <Button type="button" className="w-full" disabled={actionLoading} onClick={() => void handleCreateAction(actionDialog)}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.submitReport}
            </Button>
          </div>
        ) : (
          <AiDraftViewer
            text={generatedAction.text_generated}
            status={generatedAction.status}
            labels={labelsForAction(generatedAction.type)}
            loading={actionLoading}
            onApprove={async (text) => {
              setActionLoading(true)
              try {
                if (text !== generatedAction.text_generated) {
                  await updateAiActionText(supabase, generatedAction.id, text)
                }
                await confirmAiAction(supabase, generatedAction.id, initialContext.userId)
                setActionDialog(null)
                setGeneratedAction(null)
                void loadData()
              } finally {
                setActionLoading(false)
              }
            }}
            onReject={async () => {
              await rejectAiAction(supabase, generatedAction.id, initialContext.userId)
              setGeneratedAction(null)
            }}
            onRegenerate={() => void handleCreateAction(actionDialog)}
          />
        )}
      </ModalOverlay>
    </div>
  )
}
