/**
 * @file features/reports/components/report-form.tsx
 * @purpose کامپوننت UI — گزارش‌ها و بایگانی (report-form)
 * @safe-to-edit CAREFUL
 * @affects گزارش‌ها و بایگانی
 * @depends-on features/reports/hooks/use-reports, shared/components/ui/button, shared/components/ui/label, shared/components/ui/textarea, shared/components/ui/card, shared/components/ui/progress, shared/components/ui/alert, shared/components/ui/select, features/admin/components/shared, shared/components/ui/skeleton
 */

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProjects, useSubmitReport } from '@/features/reports/hooks/use-reports'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { PageHeader } from '@/features/admin/components/shared'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Camera, Package, AlertTriangle, Upload, FileText } from 'lucide-react'
import { REPORTS_COPY as R } from '@/features/reports/config'

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
        title={R.formTitle}
        description={R.formHint}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {R.dailyCard}
            </CardTitle>
            <CardDescription>{R.dailyCardHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{R.projectRequired}</Label>
              {projectsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : projectsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{projectsError}</AlertDescription>
                </Alert>
              ) : projects.length === 0 ? (
                <Alert>
                  <AlertDescription>{R.noProjects}</AlertDescription>
                </Alert>
              ) : (
                <Select value={projectId} onValueChange={setProjectId} disabled={isBusy}>
                  <SelectTrigger>
                    <SelectValue placeholder={R.selectProject} />
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
              placeholder={R.workPlaceholder}
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
              {R.materialsCard}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder={R.materialsPlaceholder}
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
              {R.blockersCard}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              placeholder={R.blockersPlaceholder}
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
              {R.attachCard}
            </CardTitle>
            <CardDescription>{R.attachHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="photo">{R.photoRequired}</Label>
              <input
                ref={fileInputRef}
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={isBusy}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc">{R.docOptional}</Label>
              <input
                id="doc"
                type="file"
                accept="application/pdf,image/*"
                disabled={isBusy}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
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
            <AlertTitle>{R.errorTitle}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!projectId || !selectedFile || isBusy}>
            {isBusy ? R.processing : R.uploadAnalyze}
          </Button>
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => reset()}>
            {R.clear}
          </Button>
        </div>
      </form>
    </div>
  )
}
