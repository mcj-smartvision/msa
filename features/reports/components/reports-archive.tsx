/**
 * @file features/reports/components/reports-archive.tsx
 * @purpose کامپوننت UI — گزارش‌ها و بایگانی (reports-archive)
 * @safe-to-edit CAREFUL
 * @affects گزارش‌ها و بایگانی
 * @depends-on features/reports/hooks/use-reports, shared/components/ui/badge, shared/components/ui/button, shared/components/ui/card, shared/components/ui/skeleton, shared/components/ui/alert, shared/components/ui/select, features/schedule/components/formatted-date, shared/types, features/admin/components/shared
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { REPORTS_COPY as R } from '@/features/reports/config'
import { useProjects, useReportsArchive } from '@/features/reports/hooks/use-reports'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { FormattedDate } from '@/features/schedule/components/formatted-date'
import type { EquipmentItem, ExtendedAnalysis, ReportWithAnalysis, WorkerRole } from '@/shared/types'
import { PageHeader } from '@/features/admin/components/shared'

function safetyLabel(value?: string) {
  const map: Record<string, string> = {
    yes: R.safety.yes,
    no: R.safety.no,
    partial: R.safety.partial,
    unknown: R.safety.unknown,
  }
  return map[value ?? 'unknown'] ?? value
}

function AnalysisDetails({ ext }: { ext: ExtendedAnalysis }) {
  const safety = ext.safety_equipment
  const lighting = ext.lighting
  const weather = ext.weather_air

  return (
    <div className="space-y-3 text-sm border-t pt-3 mt-2">
      {ext.supervisor_summary_fa && (
        <div className="bg-muted/50 rounded-md p-3">
          <p className="font-medium mb-1">{R.supervisorSummary}</p>
          <p className="text-muted-foreground leading-relaxed">{ext.supervisor_summary_fa}</p>
        </div>
      )}

      {ext.work_being_performed_fa && (
        <div>
          <p className="font-medium">{R.whatDoing}</p>
          <p className="text-muted-foreground">{ext.work_being_performed_fa}</p>
        </div>
      )}

      {safety && (
        <div>
          <p className="font-medium mb-1">{R.ppe}</p>
          <ul className="text-muted-foreground space-y-0.5">
            <li>{R.helmets}: {safetyLabel(safety.helmets)}</li>
            <li>{R.harnesses}: {safetyLabel(safety.harnesses)}</li>
            <li>{R.highVis}: {safetyLabel(safety.high_visibility_vests)}</li>
            <li>{R.gloves}: {safetyLabel(safety.gloves)}</li>
            <li>{R.boots}: {safetyLabel(safety.safety_boots)}</li>
            <li>{R.fallProtection}: {safetyLabel(safety.fall_protection)}</li>
          </ul>
          {safety.notes_fa && <p className="mt-1 text-muted-foreground">{safety.notes_fa}</p>}
          {safety.missing_or_concerns_fa?.length ? (
            <ul className="mt-1 text-destructive list-disc list-inside">
              {safety.missing_or_concerns_fa.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(ext.time_of_day_fa || ext.time_of_day) && (
          <div>
            <p className="font-medium">{R.dayNight}</p>
            <p className="text-muted-foreground">{ext.time_of_day_fa || ext.time_of_day}</p>
          </div>
        )}
        {lighting && (
          <div>
            <p className="font-medium">{R.lightingOk}</p>
            <p className="text-muted-foreground">
              {lighting.adequate ? R.safety.yes : R.safety.no}
              {lighting.level ? ` (${lighting.level})` : ''}
            </p>
            {lighting.notes_fa && <p className="text-xs text-muted-foreground mt-0.5">{lighting.notes_fa}</p>}
          </div>
        )}
      </div>

      {weather && (
        <div>
          <p className="font-medium">{R.weatherStatus}</p>
          <p className="text-muted-foreground">
            {weather.weather_fa || weather.weather_apparent}
            {weather.air_quality_fa ? ` — ${R.airQuality}: ${weather.air_quality_fa}` : ''}
          </p>
          {weather.visibility && <p className="text-xs text-muted-foreground">{R.visibility}: {weather.visibility}</p>}
          {weather.wind_signs_fa && <p className="text-xs text-muted-foreground">{R.wind}: {weather.wind_signs_fa}</p>}
          {weather.notes_fa && <p className="text-xs text-muted-foreground mt-0.5">{weather.notes_fa}</p>}
        </div>
      )}

      {ext.risks_observed_fa?.length ? (
        <div>
          <p className="font-medium text-destructive">{R.hseNotes}</p>
          <ul className="list-disc list-inside text-muted-foreground">
            {ext.risks_observed_fa.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ReportCard({ report }: { report: ReportWithAnalysis }) {
  const [expanded, setExpanded] = useState(false)
  const ext = report.extended_analysis_json as ExtendedAnalysis | null | undefined
  const roles = report.worker_roles_json as WorkerRole[] | undefined
  const equipment = report.equipment_json as EquipmentItem[] | undefined

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        <Image
          src={report.image_url}
          alt={report.activity_type || R.reportAlt}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{report.project_name || R.projectFallback}</CardTitle>
        <p className="text-xs text-muted-foreground"><FormattedDate value={report.created_at} dateTime /></p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {report.activity_type && <Badge>{R.activityBadge(report.activity_type)}</Badge>}
          {report.workforce_count != null && (
            <Badge variant="secondary">{R.workforceBadge(String(report.workforce_count))}</Badge>
          )}
          {report.confidence_score != null && (
            <Badge variant="outline">{R.confidenceBadge(String(Math.round(Number(report.confidence_score) * 100)))}</Badge>
          )}
        </div>

        {roles?.length ? (
          <div className="text-sm">
            <p className="font-medium">{R.workerRoles}</p>
            <ul className="text-muted-foreground list-disc list-inside">
              {roles.map((r, i) => (
                <li key={i}>
                  {r.role} ({r.count})
                  {r.activity_fa ? ` — ${r.activity_fa}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {equipment?.filter((e) => e.visible).length ? (
          <div className="text-sm">
            <p className="font-medium">{R.equipment}</p>
            <p className="text-muted-foreground">
              {equipment
                .filter((e) => e.visible)
                .map((e) => e.name + (e.usage_fa ? ` (${e.usage_fa})` : ''))
                .join(R.listSep)}
            </p>
          </div>
        ) : null}

        {ext ? (
          <>
            {expanded && <AnalysisDetails ext={ext} />}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
              {expanded ? R.closeDetails : R.openDetails}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {R.legacyHint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function ReportsArchive() {
  const [filterProjectId, setFilterProjectId] = useState<string>('all')
  const { projects } = useProjects()
  const projectId = filterProjectId === 'all' ? undefined : filterProjectId
  const { reports, loading, error, refetch } = useReportsArchive(projectId)

  return (
    <div className="space-y-6">
      <PageHeader
        title={R.archiveTitle}
        description={R.archiveHint}
        actions={
          <>
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder={R.filterProject} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{R.allProjects}</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button asChild><Link href="/reports/new">{R.newReport}</Link></Button>
          </>
        }
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>{R.retry}</Button>
          </AlertDescription>
        </Alert>
      )}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-full rounded-lg" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <p>{R.empty}</p>
          <Button asChild className="mt-4"><Link href="/reports/new">{R.firstReport}</Link></Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  )
}
