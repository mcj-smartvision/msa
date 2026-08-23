'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useProjects, useReportsArchive } from '@/hooks/useReports'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormattedDate } from '@/components/schedule/formatted-date'
import type { EquipmentItem, ExtendedAnalysis, ReportWithAnalysis, WorkerRole } from '@/types'
import { PageHeader } from '@/components/admin/shared'

function safetyLabel(value?: string) {
  const map: Record<string, string> = {
    yes: '✅ بله',
    no: '❌ خیر',
    partial: '⚠️ جزئی',
    unknown: '❓ نامشخص',
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
          <p className="font-medium mb-1">خلاصه سرپرست</p>
          <p className="text-muted-foreground leading-relaxed">{ext.supervisor_summary_fa}</p>
        </div>
      )}

      {ext.work_being_performed_fa && (
        <div>
          <p className="font-medium">چه کاری انجام می‌دهند؟</p>
          <p className="text-muted-foreground">{ext.work_being_performed_fa}</p>
        </div>
      )}

      {safety && (
        <div>
          <p className="font-medium mb-1">تجهیزات ایمنی (PPE)</p>
          <ul className="text-muted-foreground space-y-0.5">
            <li>کلاه ایمنی: {safetyLabel(safety.helmets)}</li>
            <li>مهاربند / طناب: {safetyLabel(safety.harnesses)}</li>
            <li>لباس شبرنگ: {safetyLabel(safety.high_visibility_vests)}</li>
            <li>دستکش: {safetyLabel(safety.gloves)}</li>
            <li>کفش ایمنی: {safetyLabel(safety.safety_boots)}</li>
            <li>حفاظت سقوط: {safetyLabel(safety.fall_protection)}</li>
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
            <p className="font-medium">روز / شب</p>
            <p className="text-muted-foreground">{ext.time_of_day_fa || ext.time_of_day}</p>
          </div>
        )}
        {lighting && (
          <div>
            <p className="font-medium">نور کافی؟</p>
            <p className="text-muted-foreground">
              {lighting.adequate ? '✅ بله' : '❌ خیر'}
              {lighting.level ? ` (${lighting.level})` : ''}
            </p>
            {lighting.notes_fa && <p className="text-xs text-muted-foreground mt-0.5">{lighting.notes_fa}</p>}
          </div>
        )}
      </div>

      {weather && (
        <div>
          <p className="font-medium">وضعیت آب‌وهوا و هوا</p>
          <p className="text-muted-foreground">
            {weather.weather_fa || weather.weather_apparent}
            {weather.air_quality_fa ? ` — کیفیت هوا: ${weather.air_quality_fa}` : ''}
          </p>
          {weather.visibility && <p className="text-xs text-muted-foreground">دید: {weather.visibility}</p>}
          {weather.wind_signs_fa && <p className="text-xs text-muted-foreground">باد: {weather.wind_signs_fa}</p>}
          {weather.notes_fa && <p className="text-xs text-muted-foreground mt-0.5">{weather.notes_fa}</p>}
        </div>
      )}

      {ext.risks_observed_fa?.length ? (
        <div>
          <p className="font-medium text-destructive">خطرات / نکات HSE</p>
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
          alt={report.activity_type || 'گزارش'}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{report.project_name || 'پروژه'}</CardTitle>
        <p className="text-xs text-muted-foreground"><FormattedDate value={report.created_at} dateTime /></p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {report.activity_type && <Badge>فعالیت: {report.activity_type}</Badge>}
          {report.workforce_count != null && (
            <Badge variant="secondary">نیرو: {report.workforce_count} نفر</Badge>
          )}
          {report.confidence_score != null && (
            <Badge variant="outline">اطمینان: {Math.round(Number(report.confidence_score) * 100)}%</Badge>
          )}
        </div>

        {roles?.length ? (
          <div className="text-sm">
            <p className="font-medium">نقش کارگران</p>
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
            <p className="font-medium">تجهیزات</p>
            <p className="text-muted-foreground">
              {equipment
                .filter((e) => e.visible)
                .map((e) => e.name + (e.usage_fa ? ` (${e.usage_fa})` : ''))
                .join('، ')}
            </p>
          </div>
        ) : null}

        {ext ? (
          <>
            {expanded && <AnalysisDetails ext={ext} />}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'بستن جزئیات' : 'مشاهده تحلیل کامل (ایمنی، نور، هوا...)'}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            گزارش قدیمی — برای تحلیل تفصیلی، عکس را دوباره آپلود کنید.
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
        title="آرشیو گزارش‌ها"
        description="تحلیل تفصیلی AI: ایمنی، فعالیت، نور، آب‌وهوا"
        actions={
          <>
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="فیلتر پروژه" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پروژه‌ها</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button asChild><Link href="/reports/new">گزارش جدید</Link></Button>
          </>
        }
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>تلاش مجدد</Button>
          </AlertDescription>
        </Alert>
      )}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-full rounded-lg" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <p>هنوز گزارشی ثبت نشده است.</p>
          <Button asChild className="mt-4"><Link href="/reports/new">ثبت اولین گزارش</Link></Button>
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
