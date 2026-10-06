'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import type { Project, ReportWithAnalysis, SubmitReportState } from '@/shared/types'
import {
analyzeReportImage,
fetchProjects,
fetchReportsArchive,
saveReportWithAnalysis,
uploadReportImage,
validateImageFile,
} from '@/features/reports/services/reports'

const initialSubmitState: SubmitReportState = {
  status: 'idle',
  progress: 0,
  message: '',
  error: null,
}

export function useProjects() {
  const supabase = useSupabase()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await fetchProjects(supabase)
        if (!cancelled) setProjects(data as Project[])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خطا در بارگذاری پروژه‌ها')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return { projects, loading, error }
}

export function useReportsArchive(projectId?: string) {
  const supabase = useSupabase()
  const [reports, setReports] = useState<ReportWithAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchReportsArchive(supabase, projectId)
      setReports(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری گزارش‌ها')
    } finally {
      setLoading(false)
    }
  }, [supabase, projectId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { reports, loading, error, refetch }
}

export function useSubmitReport() {
  const supabase = useSupabase()
  const [state, setState] = useState<SubmitReportState>(initialSubmitState)

  const reset = useCallback(() => setState(initialSubmitState), [])

  const submit = useCallback(
    async (file: File, projectId: string) => {
      const validationError = validateImageFile(file)
      if (validationError) {
        setState({ status: 'error', progress: 0, message: '', error: validationError })
        return null
      }

      try {
        setState({ status: 'uploading', progress: 20, message: 'در حال آپلود...', error: null })
        const { path, publicUrl } = await uploadReportImage(supabase, file, projectId)

        setState({ status: 'analyzing', progress: 55, message: 'تحلیل با AI...', error: null })
        const analysis = await analyzeReportImage(supabase, publicUrl)

        setState({ status: 'saving', progress: 85, message: 'ذخیره نتایج...', error: null })
        const saved = await saveReportWithAnalysis(supabase, {
          projectId,
          imageUrl: publicUrl,
          storagePath: path,
          analysis,
        })

        setState({ status: 'done', progress: 100, message: 'گزارش با موفقیت ثبت شد.', error: null })
        return saved
      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطای ناشناخته'
        setState({ status: 'error', progress: 0, message: '', error: message })
        return null
      }
    },
    [supabase]
  )

  return { state, submit, reset }
}
