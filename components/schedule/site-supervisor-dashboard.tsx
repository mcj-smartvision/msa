'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, Loader2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { PageHeader, LoadingBlock, ErrorBlock, EmptyState } from '@/components/admin/shared'
import { ProjectDrawingsPanel } from '@/components/technical-office/project-drawings-panel'
import { ScheduleDateToolbar } from '@/components/schedule/schedule-date-toolbar'
import { ScheduleDateInput } from '@/components/schedule/schedule-date-input'
import { SupervisorSummaryCards } from '@/components/supervisor/supervisor-summary-cards'
import { TodayActivitiesTable } from '@/components/supervisor/today-activities-table'
import { LookaheadPanel } from '@/components/supervisor/lookahead-panel'
import { ResourcesPanel } from '@/components/supervisor/resources-panel'
import { IssuesAlertsPanel } from '@/components/supervisor/issues-alerts-panel'
import {
  SupervisorSafetyActionsPanel,
  countOpenSupervisorSafetyActions,
} from '@/components/hse/supervisor-safety-actions-panel'
import {
  SupervisorWorkspaceShell,
  type SupervisorNavId,
} from '@/components/supervisor/supervisor-workspace-shell'
import { QuickReportDialog } from '@/components/supervisor/quick-report-dialog'
import { AiDraftViewer } from '@/components/shared/ai-draft-viewer'
import { ModalOverlay } from '@/components/supervisor/modal-overlay'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useScheduleViewDate } from '@/hooks/useScheduleViewDate'
import { useSupabase } from '@/hooks/useSupabase'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import { getSiteSupervisorMessages } from '@/lib/i18n/site-supervisor'
import { QcEnginePanels } from '@/components/qc/qc-engine-panels'
import { getQcMessages } from '@/lib/i18n/qc'
import {
  alertsToIssues,
  buildResourceSummary,
  computeSupervisorKpis,
  tasksToLookahead,
  tasksToTodayActivities,
} from '@/lib/supervisor/transforms'
import { VoiceToTextButton } from '@/components/shared/voice-to-text-button'
import { getSupervisorRouteCopy } from '@/lib/shared/ai-action-routing'
import type { AiDraftLabels } from '@/lib/shared/ai-types'
import type { AiActionRow, AiActionType, TodayActivity } from '@/lib/supervisor/types'
import type { DashboardUserContext } from '@/types/dashboard'
import type { ProjectAlert, ProjectTask } from '@/types/schedule'
import { fetchAllProjectTasks, fetchUnresolvedAlerts } from '@/utils/schedule'
import { fetchInventoryItems } from '@/utils/storekeeper/inventory'
import {
  confirmAiAction,
  confirmDailyReportDraft,
  createAiActionDraft,
  fetchSupervisorAiDrafts,
  rejectAiAction,
  rejectDailyReportDraft,
  submitQuickReport,
  updateAiActionText,
} from '@/utils/supervisor/dashboard'
import { cn } from '@/lib/utils'
import {
  UiBlockCustomizePanel,
  UiBlockGuard,
  UiBlockVisibilityProvider,
} from '@/components/dashboard/ui-block-visibility'

interface SiteSupervisorDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  initialTasks: ProjectTask[]
  initialAlerts: ProjectAlert[]
  visibleBlockCodes?: string[]
  initialSection?: SupervisorNavId
}

type ActionDialog = 'purchase' | 'pm_comment' | 'hse_alert' | 'instruction' | null

export function SiteSupervisorDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  initialTasks,
  initialAlerts,
  visibleBlockCodes = [],
  initialSection = 'safety',
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

  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [tasks, setTasks] = useState(initialTasks)
  const [alerts, setAlerts] = useState(initialAlerts)
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof fetchInventoryItems>>>([])
  const [aiDrafts, setAiDrafts] = useState<AiActionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quickReportActivity, setQuickReportActivity] = useState<TodayActivity | null>(null)
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null)
  const [actionTaskId, setActionTaskId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [generatedAction, setGeneratedAction] = useState<AiActionRow | null>(null)

  // Form fields for action dialogs
  const [purchaseMaterial, setPurchaseMaterial] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('1')
  const [purchaseUnit, setPurchaseUnit] = useState('عدد')
  const [purchaseDate, setPurchaseDate] = useState(viewDate)
  const [purchasePriority, setPurchasePriority] = useState<'normal' | 'urgent' | 'critical'>('normal')
  const [purchaseReason, setPurchaseReason] = useState('')
  const [pmCategory, setPmCategory] = useState('general')
  const [pmNote, setPmNote] = useState('')
  const [hseSeverity, setHseSeverity] = useState('warning')
  const [hseDesc, setHseDesc] = useState('')
  const [instructionText, setInstructionText] = useState('')
  const [activeSection, setActiveSection] = useState<SupervisorNavId>(initialSection)
  const [safetyBadge, setSafetyBadge] = useState(0)
  const qcMessages = getQcMessages(locale)
  const inspectionDrawingsHref = `/dashboard/qc/drawings?returnTo=${encodeURIComponent('/dashboard/site-supervisor?section=inspection')}`

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('section') === 'inspection') setActiveSection('inspection')
  }, [])

  function selectSection(id: SupervisorNavId) {
    setActiveSection(id)
    const url = new URL(window.location.href)
    if (id === 'inspection') url.searchParams.set('section', 'inspection')
    else url.searchParams.delete('section')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    setSafetyBadge(countOpenSupervisorSafetyActions())
  }, [])

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

  const todayActivities = useMemo(
    () => tasksToTodayActivities(tasks, viewDate, inventory),
    [tasks, viewDate, inventory]
  )
  const lookahead = useMemo(() => tasksToLookahead(tasks, viewDate), [tasks, viewDate])
  const resources = useMemo(
    () => buildResourceSummary(inventory, todayActivities.length),
    [inventory, todayActivities.length]
  )
  const kpis = useMemo(
    () => computeSupervisorKpis(tasks, todayActivities, viewDate),
    [tasks, todayActivities, viewDate]
  )
  const issues = useMemo(() => alertsToIssues(alerts, tasks), [alerts, tasks])

  function handleProjectChange(id: string) {
    setProjectId(id)
    writeProjectCookie(id)
  }

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
          priority: purchasePriority,
          reason: purchaseReason,
        }
      } else if (type === 'pm_comment') {
        payload = { category: pmCategory, note: pmNote }
      } else if (type === 'hse_alert') {
        payload = { severity: hseSeverity, description: hseDesc }
      } else if (type === 'instruction') {
        const task = tasks.find((x) => x.id === actionTaskId)
        const todayRow = todayActivities.find((a) => a.id === actionTaskId)
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
      setError(err instanceof Error ? err.message : 'اقدام ناموفق بود')
    } finally {
      setActionLoading(false)
    }
  }

  if (projectOptions.length === 0) {
    return (
      <EmptyState
        title={t.title}
        description="از ادمین پروژه بخواهید شما را با سمت سرپرست کارگاه منصوب کند."
      />
    )
  }

  return (
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={initialContext.isSystemAdmin}
      dashboard="site-supervisor"
      projectId={projectId}
    >
      <div className={cn('space-y-8', isRtl && 'text-right')}>
        <UiBlockCustomizePanel />

      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          projectOptions.length > 1 ? (
            <Select value={projectId ?? undefined} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={t.selectProject} />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      <ScheduleDateToolbar />

      {loading && tasks.length === 0 ? <LoadingBlock label={t.saving} /> : null}
      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      <SupervisorWorkspaceShell
        activeId={activeSection}
        onSelect={selectSection}
        items={[
          {
            id: 'safety',
            label: 'ایمنی و اخطارها',
            hint: 'اعلان‌های تأییدشده برای اقدام میدانی',
            badge: safetyBadge,
            badgeTone: 'danger',
          },
          {
            id: 'overview',
            label: 'خلاصه وضعیت',
            hint: 'شاخص‌های روزانه کارگاه',
          },
          {
            id: 'workshop',
            label: 'لیست‌های کارگاه',
            hint: 'دفتر فنی و وضعیت تأیید مدیر پروژه',
          },
          {
            id: 'drawings',
            label: 'نقشه‌ها',
            hint: 'نقشه‌های PDF و DWG بارگذاری‌شده توسط دفتر فنی',
          },
          {
            id: 'inspection',
            label: t.inspectionRequestNav,
            hint: t.inspectionRequestNavHint,
          },
          {
            id: 'today',
            label: 'فعالیت‌های امروز',
            hint: 'گزارش سریع و دستور کار',
          },
          {
            id: 'lookahead',
            label: 'نگاه به جلو',
            hint: 'فعالیت‌های روزهای آینده',
          },
          {
            id: 'issues',
            label: 'مسائل و هشدارها',
            hint: 'مشکلات ثبت‌شده کارگاه',
            badge: issues.filter((i) => i.status === 'open').length || undefined,
          },
          {
            id: 'resources',
            label: 'منابع و مصالح',
            hint: 'موجودی و درخواست خرید',
          },
          {
            id: 'ai',
            label: 'اقدامات هوشمند',
            hint: 'پیش‌نویس‌های در انتظار تأیید',
            badge: aiDrafts.length || undefined,
          },
        ]}
      >
        {activeSection === 'safety' ? (
          <SupervisorSafetyActionsPanel
            embedded
            onQueueChange={setSafetyBadge}
          />
        ) : null}

        {activeSection === 'overview' ? (
          <UiBlockGuard code="SS-KPI-01">
            <SupervisorSummaryCards kpis={kpis} labels={t} />
          </UiBlockGuard>
        ) : null}

        {activeSection === 'drawings' ? (
          <ProjectDrawingsPanel projectId={projectId ?? ''} canUpload={false} fa={isRtl} />
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
            <p className="text-sm text-muted-foreground">ابتدا یک پروژه انتخاب کنید.</p>
          )
        ) : null}

        {activeSection === 'workshop' ? (
          projectId ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {isRtl
                  ? 'ببینید دفتر فنی چه نوشته، مدیر تأیید کرده یا نه، و کامنت بگذارید.'
                  : 'See TO items, PM approval status, and leave comments.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" asChild>
                  <Link href={`/site-ops/prepared?projectId=${projectId}&as=supervisor`}>
                    {isRtl ? 'لیست‌های کارگاه' : 'Workshop lists'}
                  </Link>
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/site-ops/schedule?projectId=${projectId}&as=supervisor`}>
                    {isRtl ? 'مشاهده برنامه (فقط خواندنی)' : 'View schedule (read-only)'}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ابتدا یک پروژه انتخاب کنید.</p>
          )
        ) : null}

        {activeSection === 'today' ? (
          <UiBlockGuard code="SS-TBL-01">
            <TodayActivitiesTable
              activities={todayActivities}
              labels={t}
              isRtl={isRtl}
              onOpenQuickReport={(id) => {
                const act = todayActivities.find((a) => a.id === id) ?? null
                setQuickReportActivity(act)
              }}
              onCreateInstruction={(id) => {
                setActionTaskId(id)
                setInstructionText('')
                setGeneratedAction(null)
                setActionDialog('instruction')
              }}
            />
          </UiBlockGuard>
        ) : null}

        {activeSection === 'lookahead' ? (
          <UiBlockGuard code="SS-PNL-01">
            <LookaheadPanel activities={lookahead} labels={t} isRtl={isRtl} />
          </UiBlockGuard>
        ) : null}

        {activeSection === 'issues' ? (
          <UiBlockGuard code="SS-PNL-03">
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
          </UiBlockGuard>
        ) : null}

        {activeSection === 'resources' ? (
          <UiBlockGuard code="SS-PNL-02">
            <ResourcesPanel
              resources={resources}
              labels={t}
              onRequestPurchase={() => {
                setGeneratedAction(null)
                setActionDialog('purchase')
              }}
            />
          </UiBlockGuard>
        ) : null}

        {activeSection === 'ai' ? (
          <UiBlockGuard code="SS-PNL-04">
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
          </UiBlockGuard>
        ) : null}
      </SupervisorWorkspaceShell>

      <UiBlockGuard code="SS-ACT-01">
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
          const { report, summaryText } = await submitQuickReport(supabase, input, locale === 'fa' ? 'fa' : 'en')
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
      </UiBlockGuard>

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
                  <Label>{isRtl ? 'مصالح' : 'Material'}</Label>
                  <Input value={purchaseMaterial} onChange={(e) => setPurchaseMaterial(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{isRtl ? 'تعداد' : 'Qty'}</Label>
                    <Input type="number" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRtl ? 'واحد' : 'Unit'}</Label>
                    <Input value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} />
                  </div>
                </div>
                <ScheduleDateInput
                  label={isRtl ? 'تاریخ نیاز' : 'Needed date'}
                  valueIso={purchaseDate}
                  onChangeIso={setPurchaseDate}
                />
                <div className="space-y-2">
                  <Label>{isRtl ? 'دلیل' : 'Reason'}</Label>
                  <Textarea rows={3} value={purchaseReason} onChange={(e) => setPurchaseReason(e.target.value)} />
                </div>
              </>
            ) : null}
            {actionDialog === 'pm_comment' ? (
              <>
                <div className="space-y-2">
                  <Label>{isRtl ? 'دسته' : 'Category'}</Label>
                  <Select value={pmCategory} onValueChange={setPmCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delay">{isRtl ? 'ریسک تأخیر' : 'Delay risk'}</SelectItem>
                      <SelectItem value="resource">{isRtl ? 'منابع' : 'Resource'}</SelectItem>
                      <SelectItem value="coordination">{isRtl ? 'هماهنگی' : 'Coordination'}</SelectItem>
                      <SelectItem value="general">{isRtl ? 'عمومی' : 'General'}</SelectItem>
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
                    <SelectItem value="info">{isRtl ? 'اطلاع' : 'Info'}</SelectItem>
                    <SelectItem value="warning">{isRtl ? 'هشدار' : 'Warning'}</SelectItem>
                    <SelectItem value="critical">{isRtl ? 'بحرانی' : 'Critical'}</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea rows={4} value={hseDesc} onChange={(e) => setHseDesc(e.target.value)} />
              </>
            ) : null}
            {actionDialog === 'instruction' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed rounded-md border bg-muted/30 px-3 py-2">
                  {isFa
                    ? 'این دکمه «دستور کار» برای پیمانکار/اجراکننده همان فعالیت است. متن پیش‌نویس AI ساخته می‌شود؛ بعد از تأیید شما به مدیر پروژه می‌رود. ابلاغ نهایی فقط وقتی ممکن است که مدیر پروژه پیمانکار را قبلاً معرفی کرده باشد.'
                    : 'Work instruction for the subcontractor/crew. After you approve, it goes to the Project Manager. Final release requires a registered subcontractor.'}
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
                  placeholder={
                    isFa
                      ? 'جزئیات دستور به پیمانکار (اختیاری — صدا یا تایپ)…'
                      : 'Instruction details (optional — voice or type)…'
                  }
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
    </UiBlockVisibilityProvider>
  )
}
