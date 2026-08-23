'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  FileWarning,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { PageHeader, LoadingBlock, ErrorBlock, SectionCard, EmptyState } from '@/components/admin/shared'
import { StatCard } from '@/components/admin/stat-card'
import { AiDraftViewer } from '@/components/shared/ai-draft-viewer'
import { ModalOverlay } from '@/components/shared/modal-overlay'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { FormattedDate } from '@/components/schedule/formatted-date'
import { useSupabase } from '@/hooks/useSupabase'
import {
  getQcMessages,
  INSPECTION_STATUS_LABELS,
  NCR_STATUS_LABELS,
  qcAiLabels,
} from '@/lib/i18n/qc'
import type {
  ChecklistItem,
  InspectionStatus,
  LabTestRecord,
  NcrRecord,
  QcKpis,
  QualityInspection,
} from '@/lib/qc/types'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import type { DashboardUserContext } from '@/types/dashboard'
import {
  approveNcrDraft,
  closeNcr,
  createNcrFromFailedInspection,
  DEFAULT_CHECKLIST,
  generateNcrDraft,
  loadQcDashboard,
  rejectNcrDraft,
  saveInspectionResult,
} from '@/utils/qc/dashboard'
import { cn } from '@/lib/utils'
import {
  UiBlockCustomizePanel,
  UiBlockGuard,
  UiBlockVisibilityProvider,
} from '@/components/dashboard/ui-block-visibility'
import { QcEnginePanels } from '@/components/qc/qc-engine-panels'

interface QcDashboardProps {
  initialContext: DashboardUserContext
  projectOptions: { id: string; name: string }[]
  initialProjectId: string | null
  visibleBlockCodes?: string[]
}

function priorityVariant(p: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (p === 'critical' || p === 'high') return 'destructive'
  if (p === 'medium') return 'secondary'
  return 'outline'
}

export function QcDashboard({
  initialContext,
  projectOptions,
  initialProjectId,
  visibleBlockCodes = [],
}: QcDashboardProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getQcMessages(locale)
  const aiLabels = qcAiLabels(t)
  const isRtl = dir === 'rtl'

  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [inspections, setInspections] = useState<QualityInspection[]>([])
  const [ncrs, setNcrs] = useState<NcrRecord[]>([])
  const [labTests, setLabTests] = useState<LabTestRecord[]>([])
  const [kpis, setKpis] = useState<QcKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inspectTarget, setInspectTarget] = useState<QualityInspection | null>(null)
  const [ncrTarget, setNcrTarget] = useState<NcrRecord | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertDesc, setAlertDesc] = useState('')

  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map((item) => ({ item, ok: true }))
  )
  const [inspectStatus, setInspectStatus] = useState<InspectionStatus>('passed')
  const [inspectComments, setInspectComments] = useState('')

  const loadData = useCallback(async () => {
    if (!projectId) {
      setInspections([])
      setNcrs([])
      setLabTests([])
      setKpis(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loadQcDashboard(supabase, projectId)
      setInspections(data.inspections)
      setNcrs(data.ncrs)
      setLabTests(data.labTests)
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

  function handleProjectChange(id: string) {
    setProjectId(id)
    writeProjectCookie(id)
  }

  function openInspect(row: QualityInspection) {
    setInspectTarget(row)
    setChecklist(
      row.checklistResults.length
        ? row.checklistResults
        : DEFAULT_CHECKLIST.map((item) => ({ item, ok: true }))
    )
    setInspectStatus(row.status === 'pending' ? 'passed' : row.status)
    setInspectComments(row.comments ?? '')
  }

  async function handleSaveInspection() {
    if (!inspectTarget || !projectId) return
    setActionId(inspectTarget.id)
    try {
      await saveInspectionResult(supabase, {
        projectId,
        activityId: inspectTarget.activityId,
        inspectorId: initialContext.userId,
        status: inspectStatus,
        priority: inspectTarget.priority,
        checklistResults: checklist,
        comments: inspectComments || undefined,
      })
      if (inspectStatus === 'failed') {
        await createNcrFromFailedInspection(supabase, {
          projectId,
          userId: initialContext.userId,
          activityId: inspectTarget.activityId,
          activityName: inspectTarget.activityName,
          comments: inspectComments,
          locale: locale === 'fa' ? 'fa' : 'en',
        })
      }
      setInspectTarget(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setActionId(null)
    }
  }

  async function handleGenerateAlert() {
    if (!projectId || !alertTitle.trim()) return
    setActionId('alert')
    try {
      await generateNcrDraft(supabase, {
        projectId,
        userId: initialContext.userId,
        title: alertTitle,
        description: alertDesc,
        locale: locale === 'fa' ? 'fa' : 'en',
      })
      setAlertTitle('')
      setAlertDesc('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setActionId(null)
    }
  }

  async function handleApproveNcr(editedText: string) {
    if (!ncrTarget) return
    setActionId(ncrTarget.id)
    try {
      await approveNcrDraft(supabase, ncrTarget.id, initialContext.userId, editedText)
      setNcrTarget(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setActionId(null)
    }
  }

  return (
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={initialContext.isSystemAdmin}
      dashboard="qc"
      projectId={projectId}
    >
    <div className="space-y-6" dir={dir}>
      <UiBlockCustomizePanel />

      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          projectOptions.length > 1 ? (
            <Select value={projectId ?? ''} onValueChange={handleProjectChange}>
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

      {error ? <ErrorBlock message={error} onRetry={() => void loadData()} /> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && kpis ? (
        <>
          <UiBlockGuard code="QC-KPI-01">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t.passRate} value={`${kpis.passRate}%`} icon={CheckCircle2} />
            <StatCard label={t.openNcrs} value={String(kpis.openNcrCount)} icon={FileWarning} />
            <StatCard label={t.pendingInspections} value={String(kpis.pendingInspections)} icon={ClipboardCheck} />
            <StatCard label={t.failedTests} value={String(kpis.failedTests)} icon={FlaskConical} trendType={kpis.failedTests > 0 ? 'warning' : 'neutral'} />
            <StatCard label={t.resolvedIssues} value={String(kpis.resolvedIssues)} icon={CheckCircle2} />
            <StatCard label={t.todayInspections} value={String(kpis.todayInspections)} icon={ClipboardCheck} />
            <StatCard
              label={t.highSeverity}
              value={String(kpis.highSeverityFindings)}
              icon={AlertTriangle}
              trendType={kpis.highSeverityFindings > 0 ? 'warning' : 'neutral'}
            />
          </div>
          </UiBlockGuard>

          <UiBlockGuard code="QC-TBL-01">
          <SectionCard title={t.inspectionWorklist}>
            {inspections.length === 0 ? (
              <EmptyState title={t.inspectionWorklist} description={t.noInspections} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-start">
                      <th className="py-2 pe-4">{t.activity}</th>
                      <th className="py-2 pe-4">{t.wbs}</th>
                      <th className="py-2 pe-4">{t.priority}</th>
                      <th className="py-2 pe-4">{t.status}</th>
                      <th className="py-2">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-3 pe-4 font-medium">{row.activityName}</td>
                        <td className="py-3 pe-4">{row.wbsCode}</td>
                        <td className="py-3 pe-4">
                          <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge>
                        </td>
                        <td className="py-3 pe-4">
                          {t[INSPECTION_STATUS_LABELS[row.status]]}
                        </td>
                        <td className="py-3">
                          <Button type="button" size="sm" variant="outline" onClick={() => openInspect(row)}>
                            {t.inspect}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
          </UiBlockGuard>

          <UiBlockGuard code="QC-TBL-02">
          <SectionCard title={t.ncrManagement}>
            {ncrs.length === 0 ? (
              <EmptyState title={t.ncrManagement} description={t.noNcrs} />
            ) : (
              <div className="space-y-3">
                {ncrs.map((ncr) => (
                  <div
                    key={ncr.id}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4',
                      ncr.status === 'draft_by_ai' && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                    )}
                  >
                    <div>
                      <p className="font-medium">
                        {ncr.ncrNumber} — {ncr.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ncr.relatedActivity ?? '—'} · {t[ NCR_STATUS_LABELS[ncr.status] ]} ·{' '}
                        <FormattedDate value={ncr.createdAt} />
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {ncr.status === 'draft_by_ai' ? (
                        <Button type="button" size="sm" onClick={() => setNcrTarget(ncr)}>
                          {t.viewDraft}
                        </Button>
                      ) : null}
                      {ncr.status === 'open' || ncr.status === 'under_review' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionId === ncr.id}
                          onClick={() => void closeNcr(supabase, ncr.id).then(loadData)}
                        >
                          {t.markClosed}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          </UiBlockGuard>

          <UiBlockGuard code="QC-TBL-03">
          <SectionCard title={t.labTests}>
            {labTests.length === 0 ? (
              <EmptyState title={t.labTests} description={t.noLabTests} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-start">
                      <th className="py-2 pe-4">{t.sampleId}</th>
                      <th className="py-2 pe-4">{t.testType}</th>
                      <th className="py-2 pe-4">{t.required}</th>
                      <th className="py-2 pe-4">{t.actual}</th>
                      <th className="py-2">{t.result}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labTests.map((test) => (
                      <tr
                        key={test.id}
                        className={cn('border-b last:border-0', !test.pass && 'bg-red-50/50 dark:bg-red-950/20')}
                      >
                        <td className="py-3 pe-4">{test.sampleId}</td>
                        <td className="py-3 pe-4">{test.testType.replace(/_/g, ' ')}</td>
                        <td className="py-3 pe-4">
                          {test.requiredValue} {test.unit}
                        </td>
                        <td className="py-3 pe-4">
                          {test.actualValue} {test.unit}
                        </td>
                        <td className="py-3">
                          {test.pass ? (
                            <Badge>{t.pass}</Badge>
                          ) : (
                            <Badge variant="destructive">{t.fail}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
          </UiBlockGuard>

          <UiBlockGuard code="QC-PNL-01">
          <SectionCard title={t.qualityAlerts}>
            <p className="text-sm text-muted-foreground mb-4">{t.alertHint}</p>
            <div className="grid gap-3 max-w-xl">
              <div>
                <Label>{t.activity}</Label>
                <Input value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} />
              </div>
              <div>
                <Label>{t.comments}</Label>
                <Textarea rows={3} value={alertDesc} onChange={(e) => setAlertDesc(e.target.value)} />
              </div>
              <Button
                type="button"
                disabled={!alertTitle.trim() || actionId === 'alert'}
                onClick={() => void handleGenerateAlert()}
              >
                {t.generateDraft}
              </Button>
            </div>
          </SectionCard>
          </UiBlockGuard>
        </>
      ) : null}

      {!loading && projectId ? (
        <QcEnginePanels
          projectId={projectId}
          t={t}
          isInspector={initialContext.positionKeys.includes('qa_qc_inspector')}
        />
      ) : null}

      {inspectTarget ? (
        <ModalOverlay
          open={!!inspectTarget}
          onClose={() => setInspectTarget(null)}
          title={inspectTarget.activityName}
          className="sm:max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {inspectTarget.wbsCode} · {inspectTarget.location}
            </p>

            <div>
              <Label>{t.checklist}</Label>
              <div className="mt-2 space-y-2">
                {checklist.map((item, idx) => (
                  <label key={item.item} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.ok}
                      onChange={(e) => {
                        const next = [...checklist]
                        next[idx] = { ...item, ok: e.target.checked }
                        setChecklist(next)
                      }}
                      className="mt-1"
                    />
                    <span>{item.item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>{t.finalDecision}</Label>
              <Select value={inspectStatus} onValueChange={(v) => setInspectStatus(v as InspectionStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">{t.passed}</SelectItem>
                  <SelectItem value="passed_with_comments">{t.passedComments}</SelectItem>
                  <SelectItem value="failed">{t.failed}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t.comments}</Label>
              <Textarea rows={3} value={inspectComments} onChange={(e) => setInspectComments(e.target.value)} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setInspectTarget(null)}>
                {t.close}
              </Button>
              <Button type="button" disabled={actionId === inspectTarget.id} onClick={() => void handleSaveInspection()}>
                {actionId === inspectTarget.id ? t.saving : t.saveInspection}
              </Button>
            </div>
          </div>
        </ModalOverlay>
      ) : null}

      {ncrTarget ? (
        <ModalOverlay
          open={!!ncrTarget}
          onClose={() => setNcrTarget(null)}
          title={`${ncrTarget.ncrNumber} — ${ncrTarget.title}`}
          className="sm:max-w-2xl"
        >
          <div className="space-y-4">
            <AiDraftViewer
              text={ncrTarget.aiGeneratedOfficialText}
              status="draft_by_ai"
              labels={aiLabels}
              loading={actionId === ncrTarget.id}
              onApprove={(text) => handleApproveNcr(text)}
              onReject={async () => {
                setActionId(ncrTarget.id)
                try {
                  await rejectNcrDraft(supabase, ncrTarget.id)
                  setNcrTarget(null)
                  await loadData()
                } finally {
                  setActionId(null)
                }
              }}
            />
            <Button type="button" variant="ghost" onClick={() => setNcrTarget(null)}>
              {t.close}
            </Button>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
    </UiBlockVisibilityProvider>
  )
}
