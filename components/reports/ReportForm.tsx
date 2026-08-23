'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjects, useSubmitReport } from '@/hooks/useReports'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/admin/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { Camera, Package, AlertTriangle, Upload, FileText } from 'lucide-react'

export function ReportForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [projectId, setProjectId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [dailyNote, setDailyNote] = useState('')
  const [materialLog, setMaterialLog] = useState('')
  const [blockers, setBlockers] = useState('')
  const { projects, loading: projectsLoading, error: projectsError } = useProjects()
  const { state, submit, reset } = useSubmitReport()
  const isBusy = ['uploading', 'analyzing', 'saving'].includes(state.status)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !selectedFile) return
    const result = await submit(selectedFile, projectId)
    if (result) setTimeout(() => router.push('/reports'), 800)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      <PageHeader
        title="ثبت گزارش کارگاه"
        description="گزارش روزانه، مصالح، موانع و عکس — برای تحلیل هوشمند و آرشیو مدیریتی"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              گزارش روزانه
            </CardTitle>
            <CardDescription>خلاصه کارهای انجام‌شده و وضعیت کلی امروز</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>پروژه *</Label>
              {projectsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : projectsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{projectsError}</AlertDescription>
                </Alert>
              ) : projects.length === 0 ? (
                <Alert>
                  <AlertDescription>پروژه‌ای یافت نشد.</AlertDescription>
                </Alert>
              ) : (
                <Select value={projectId} onValueChange={setProjectId} disabled={isBusy}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب پروژه" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Textarea
              rows={4}
              placeholder="امروز چه کارهایی انجام شد؟ پیشرفت، نیرو، تجهیزات…"
              value={dailyNote}
              onChange={(e) => setDailyNote(e.target.value)}
              disabled={isBusy}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5" />
              لاگ مصالح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder="دریافت، کمبود، ETA تحویل…"
              value={materialLog}
              onChange={(e) => setMaterialLog(e.target.value)}
              disabled={isBusy}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              موانع و تأخیرها
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder="علت توقف، مدت تأخیر، مسئول پیگیری…"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              disabled={isBusy}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-5 w-5" />
              عکس و پیوست
            </CardTitle>
            <CardDescription>عکس کارگاه برای تحلیل AI الزامی است</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="photo">عکس کارگاه *</Label>
              <input
                ref={fileInputRef}
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={isBusy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc">سند / PDF (اختیاری)</Label>
              <input
                id="doc"
                type="file"
                accept="application/pdf,image/*"
                disabled={isBusy}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
              {docFile ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  {docFile.name}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {isBusy && (
          <div className="space-y-2">
            <Progress value={state.progress} />
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        )}
        {state.status === 'error' && state.error && (
          <Alert variant="destructive">
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!projectId || !selectedFile || isBusy}>
            {isBusy ? 'در حال پردازش…' : 'آپلود و تحلیل'}
          </Button>
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => reset()}>
            پاک کردن
          </Button>
        </div>
      </form>
    </div>
  )
}
