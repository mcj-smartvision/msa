/**
 * @file features/dashboard/components/widgets/daily-report-widget.tsx
 * @purpose کامپوننت UI — داشبورد نقش‌ها و ویجت‌ها (daily-report-widget)
 * @safe-to-edit CAREFUL
 * @affects داشبورد نقش‌ها و ویجت‌ها
 * @depends-on shared/hooks/use-supabase, features/reports/services/reports, shared/types, shared/types/dashboard, features/dashboard/components/widgets/widget-shell, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/textarea, shared/components/ui/progress
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import {
analyzeReportImage,
uploadReportImage,
validateImageFile,
} from '@/features/reports/services/reports'
import type { AIAnalysisResponse } from '@/shared/types'
import type { DailyReportStep, WidgetRenderContext } from '@/shared/types/dashboard'
import { WidgetShell } from '@/features/dashboard/components/widgets/widget-shell'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Progress } from '@/shared/components/ui/progress'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { DailyReportWeatherBanner } from '@/features/weather/components/daily-report-weather'
import { useWeather } from '@/features/weather/hooks/use-weather'
import {
  ensureWeatherLine,
  formatWeatherReportLine,
  overlayWeatherAir,
} from '@/features/weather/lib/report-stamp'
import { DAILY_REPORT_WIDGET_COPY as copy } from '@/features/dashboard/config'

export function DailyReportWidget({ context }: { context: WidgetRenderContext }) {
  const supabase = useSupabase()
  const fileRef = useRef<HTMLInputElement>(null)
  const projectId = context.projectId ?? context.user.projects[0]?.project.id ?? ''
  const { data: weather } = useWeather(projectId || null)

  const [step, setStep] = useState<DailyReportStep>('compose')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activityType, setActivityType] = useState('')
  const [workforceCount, setWorkforceCount] = useState(0)
  const [supervisorSummary, setSupervisorSummary] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!weather) return
    const line = formatWeatherReportLine(weather)
    setDescription((prev) => ensureWeatherLine(prev, line))
  }, [weather])

  function handleFileChange(file: File | null) {
    setImageFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  async function handleAnalyze() {
    if (!projectId) {
      setError(copy.noProject)
      return
    }
    if (!description.trim()) {
      setError(copy.needDescription)
      return
    }
    if (!imageFile) {
      setError(copy.needPhoto)
      return
    }

    const validationError = validateImageFile(imageFile)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setLoading(true)
    setProgress(20)
    setMessage(copy.uploading)

    try {
      const uploaded = await uploadReportImage(supabase, imageFile, projectId)
      setImageUrl(uploaded.publicUrl)
      setStoragePath(uploaded.path)

      setProgress(55)
      setMessage(copy.analyzing)
      const result = await analyzeReportImage(supabase, uploaded.publicUrl, projectId)
      if (weather) {
        result.extended_analysis_json = {
          ...result.extended_analysis_json,
          weather_air: overlayWeatherAir(result.extended_analysis_json?.weather_air, weather),
        }
      }
      setAnalysis(result)
      setActivityType(result.activity_type)
      setWorkforceCount(result.workforce_count)
      setSupervisorSummary(result.extended_analysis_json?.supervisor_summary_fa ?? '')
      setStep('review')
      setProgress(100)
      setMessage(copy.reviewHint)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.analyzeFailed)
    } finally {
      setLoading(false)
    }
  }

  async function handleFinalize() {
    if (!projectId || !imageUrl || !storagePath || !analysis) return

    setLoading(true)
    setError(null)
    setMessage(copy.saving)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error(copy.unauthenticated)

      const descriptionWithWeather = weather
        ? ensureWeatherLine(description.trim(), formatWeatherReportLine(weather))
        : description.trim()
      const finalizedAnalysis: AIAnalysisResponse = {
        ...analysis,
        activity_type: activityType.trim() || analysis.activity_type,
        workforce_count: workforceCount,
        extended_analysis_json: {
          ...analysis.extended_analysis_json,
          supervisor_summary_fa: supervisorSummary.trim() || analysis.extended_analysis_json?.supervisor_summary_fa,
          activity_description_fa: descriptionWithWeather,
          weather_air: weather
            ? overlayWeatherAir(analysis.extended_analysis_json?.weather_air, weather)
            : analysis.extended_analysis_json?.weather_air,
        },
      }

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          project_id: projectId,
          image_url: imageUrl,
          image_storage_path: storagePath,
          created_by: user.id,
          description: descriptionWithWeather,
          is_finalized: true,
        })
        .select()
        .single()

      if (reportError) throw new Error(reportError.message)

      const { error: analysisError } = await supabase.from('photo_analysis').insert({
        report_id: report.id,
        activity_type: finalizedAnalysis.activity_type,
        workforce_count: finalizedAnalysis.workforce_count,
        worker_roles_json: finalizedAnalysis.worker_roles_json,
        equipment_json: finalizedAnalysis.equipment_json,
        confidence_score: finalizedAnalysis.confidence_score,
        extended_analysis_json: finalizedAnalysis.extended_analysis_json ?? null,
        ai_raw_data: finalizedAnalysis.ai_raw_data ?? finalizedAnalysis,
      })

      if (analysisError) {
        await supabase.from('reports').delete().eq('id', report.id)
        throw new Error(analysisError.message)
      }

      setStep('done')
      setMessage(copy.saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setStep('compose')
    setDescription(weather ? formatWeatherReportLine(weather) : '')
    handleFileChange(null)
    setActivityType('')
    setWorkforceCount(0)
    setSupervisorSummary('')
    setAnalysis(null)
    setImageUrl(null)
    setStoragePath(null)
    setError(null)
    setMessage('')
    setProgress(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <WidgetShell
      title={copy.title}
      description={copy.description}
    >
      {projectId ? (
        <div className="mb-4">
          <DailyReportWeatherBanner projectId={projectId} compact />
        </div>
      ) : null}
      {!projectId ? (
        <p className="text-sm text-muted-foreground">{copy.needProject}</p>
      ) : step === 'done' ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button onClick={resetForm}>{copy.another}</Button>
        </div>
      ) : step === 'compose' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-description">{copy.descriptionLabel}</Label>
            <Textarea
              id="daily-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={copy.descriptionPlaceholder}
              rows={4}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-photo">{copy.photoLabel}</Label>
            <Input
              ref={fileRef}
              id="daily-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={loading}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={copy.previewAlt} className="mt-2 max-h-40 rounded-md border object-cover" />
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button onClick={handleAnalyze} disabled={loading}>
            {copy.analyze}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {copy.reviewIntro}
          </p>
          {analysis?.extended_analysis_json?.weather_air?.notes_fa ||
          analysis?.extended_analysis_json?.weather_air?.weather_fa ? (
            <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              {analysis.extended_analysis_json.weather_air?.notes_fa ||
                analysis.extended_analysis_json.weather_air?.weather_fa}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-type">{copy.activityType}</Label>
              <Input
                id="activity-type"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workforce-count">{copy.workforce}</Label>
              <Input
                id="workforce-count"
                type="number"
                min={0}
                value={workforceCount}
                onChange={(e) => setWorkforceCount(Number(e.target.value))}
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supervisor-summary">{copy.supervisorSummary}</Label>
            <Textarea
              id="supervisor-summary"
              value={supervisorSummary}
              onChange={(e) => setSupervisorSummary(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description-review">{copy.descriptionReview}</Label>
            <Textarea
              id="description-review"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('compose')} disabled={loading}>
              {copy.back}
            </Button>
            <Button onClick={handleFinalize} disabled={loading}>
              {loading ? copy.savingButton : copy.finalize}
            </Button>
          </div>
        </div>
      )}
    </WidgetShell>
  )
}
