'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, Loader2 } from 'lucide-react'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { PageHeader, LoadingBlock, ErrorBlock, EmptyState } from '@/features/admin/components/shared'
import { SupervisorDrawingsZoningPanel } from '@/features/supervisor/components/supervisor-drawings-zoning-panel'
import { DailyReportPanel } from '@/features/supervisor/components/daily-report-panel'
import { DailyReportBackgroundPanel } from '@/features/supervisor/components/daily-report-background-panel'
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
  initialSection = 'daily-report',
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
  const [purchaseUnit, setPurchaseUnit] = useState('عدد')
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
    if (id === 'daily-report') url.searchParams.delete('section')
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
  const todayActivities = useMemo(
    () => tasksToTodayActivities(tasks, viewDate, inventory),
    [tasks, viewDate, inventory]
  )
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
    <div className={cn('space-y-8', isRtl && 'text-right')}>

      <PageHeader
        title={t.title}
        description={t.description}
      />

      {loading && tasks.length === 0 ? <LoadingBlock label={t.saving} /> : null}
      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}

      <SupervisorWorkspaceShell
        activeId={activeSection}
        onSelect={selectSection}
        items={[
          {
            id: 'daily-report',
            label: 'ثبت گزارش روزانه',
            hint: 'ثبت درصد پیشرفت روزانه فعالیت‌ها',
          },
          {
            id: 'report-background',
            label: 'بک‌گراند گزارش‌های روزانه',
            hint: 'همه درصدهای ثبت‌شده به تفکیک روز — مشاهده و ویرایش',
          },
          {
            id: 'holidays',
            label: 'تعطیلات',
            hint: 'تعطیلات هفتگی، رسمی و سازمانی — در تقویم و پیش‌بینی برنامه اثر دارد',
          },
          {
            id: 'safety',
            label: 'ایمنی و اخطارها',
            hint: 'اعلان‌های تأییدشده برای اقدام میدانی',
            badge: safetyBadge,
            badgeTone: 'danger',
            badgeTitle: openSafetyAlertsTitle(safetyBadge),
          },
          {
            id: 'overview',
            label: 'خلاصه وضعیت',
            hint: 'شاخص‌های روزانه کارگاه',
          },
          {
            id: 'drawings',
            label: 'نقشه و زون‌بندی پروژه',
            hint: 'نقشه‌های بارگذاری‌شده توسط دفتر فنی — به تفکیک رشته و زون‌های عملیاتی',
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
          {
            id: 'workshop',
            label: 'لیست‌های کارگاه',
            hint: 'دفتر فنی و وضعیت تأیید مدیر پروژه',
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
                  <Link
                    href={`/dashboard/technical-office?section=schedule&workshopTab=prepared&projectId=${projectId}&as=supervisor`}
                  >
                    {isRtl ? 'لیست‌های کارگاه' : 'Workshop lists'}
                  </Link>
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link
                    href={`/dashboard/technical-office?section=schedule&workshopTab=schedule&projectId=${projectId}&as=supervisor`}
                  >
                    {isRtl ? 'مشاهده برنامه (فقط خواندنی)' : 'View schedule (read-only)'}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ابتدا یک پروژه انتخاب کنید.</p>
          )
        ) : null}

        {activeSection === 'daily-report' ? (
          <DailyReportPanel
            projectId={projectId}
            projectName={projectOptions.find((p) => p.id === projectId)?.name ?? ''}
          />
        ) : null}

        {activeSection === 'report-background' ? <DailyReportBackgroundPanel projectId={projectId} /> : null}

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

      <PackageProgressDialog
        open={!!packageProgressActivity}
        onClose={() => setPackageProgressActivity(null)}
        activity={packageProgressActivity}
        viewDate={viewDate}
        labels={t}
        locale={locale === 'fa' ? 'fa' : 'en'}
        onSaved={() => {
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
  )
}
