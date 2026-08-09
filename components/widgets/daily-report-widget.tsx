'use client'

import { useRef, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import {
  analyzeReportImage,
  uploadReportImage,
  validateImageFile,
} from '@/utils/reports'
import type { AIAnalysisResponse } from '@/types'
import type { DailyReportStep, WidgetRenderContext } from '@/types/dashboard'
import { WidgetShell } from '@/components/widgets/widget-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function DailyReportWidget({ context }: { context: WidgetRenderContext }) {
  const supabase = useSupabase()
  const fileRef = useRef<HTMLInputElement>(null)
  const projectId = context.projectId ?? context.user.projects[0]?.project.id ?? ''

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

  function handleFileChange(file: File | null) {
    setImageFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  async function handleAnalyze() {
    if (!projectId) {
      setError('پروژه‌ای اختصاص داده نشده است.')
      return
    }
    if (!description.trim()) {
      setError('لطفاً شرح گزارش را وارد کنید.')
      return
    }
    if (!imageFile) {
      setError('لطفاً عکس سایت را بارگذاری کنید.')
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
    setMessage('در حال بارگذاری عکس...')

    try {
      const uploaded = await uploadReportImage(supabase, imageFile, projectId)
      setImageUrl(uploaded.publicUrl)
      setStoragePath(uploaded.path)

      setProgress(55)
      setMessage('در حال تحلیل با هوش مصنوعی...')
      const result = await analyzeReportImage(supabase, uploaded.publicUrl)
      setAnalysis(result)
      setActivityType(result.activity_type)
      setWorkforceCount(result.workforce_count)
      setSupervisorSummary(result.extended_analysis_json?.supervisor_summary_fa ?? '')
      setStep('review')
      setProgress(100)
      setMessage('نتایج هوش مصنوعی را بررسی و قبل از نهایی‌سازی ویرایش کنید.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تحلیل ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  async function handleFinalize() {
    if (!projectId || !imageUrl || !storagePath || !analysis) return

    setLoading(true)
    setError(null)
    setMessage('در حال ذخیره گزارش...')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('احراز هویت نشده‌اید')

      const finalizedAnalysis: AIAnalysisResponse = {
        ...analysis,
        activity_type: activityType.trim() || analysis.activity_type,
        workforce_count: workforceCount,
        extended_analysis_json: {
          ...analysis.extended_analysis_json,
          supervisor_summary_fa: supervisorSummary.trim() || analysis.extended_analysis_json?.supervisor_summary_fa,
          activity_description_fa: description.trim(),
        },
      }

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          project_id: projectId,
          image_url: imageUrl,
          image_storage_path: storagePath,
          created_by: user.id,
          description: description.trim(),
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
      setMessage('گزارش روزانه با موفقیت نهایی شد.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setStep('compose')
    setDescription('')
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
      title="گزارش روزانه"
      description="کار سایت را شرح دهید، عکس پیوست کنید، خروجی هوش مصنوعی را بررسی و سپس نهایی کنید"
    >
      {!projectId ? (
        <p className="text-sm text-muted-foreground">برای ثبت گزارش روزانه باید پروژه اختصاص‌یافته داشته باشید.</p>
      ) : step === 'done' ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button onClick={resetForm}>ثبت گزارش دیگر</Button>
        </div>
      ) : step === 'compose' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-description">شرح گزارش</Label>
            <Textarea
              id="daily-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="فعالیت‌ها، پیشرفت و مسائل امروز سایت را شرح دهید..."
              rows={4}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-photo">عکس سایت</Label>
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
              <img src={previewUrl} alt="پیش‌نمایش" className="mt-2 max-h-40 rounded-md border object-cover" />
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
            تحلیل و بررسی
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            فیلدهای تولیدشده توسط هوش مصنوعی را ویرایش کنید، سپس گزارش را نهایی کنید.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-type">نوع فعالیت</Label>
              <Input
                id="activity-type"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workforce-count">تعداد نیروی کار</Label>
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
            <Label htmlFor="supervisor-summary">خلاصه سرپرست</Label>
            <Textarea
              id="supervisor-summary"
              value={supervisorSummary}
              onChange={(e) => setSupervisorSummary(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description-review">شرح گزارش (قابل ویرایش)</Label>
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
              بازگشت
            </Button>
            <Button onClick={handleFinalize} disabled={loading}>
              {loading ? 'در حال ذخیره...' : 'نهایی‌سازی گزارش'}
            </Button>
          </div>
        </div>
      )}
    </WidgetShell>
  )
}
