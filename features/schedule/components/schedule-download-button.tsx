'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

function ensureXmlExtension(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'schedule.xml'
  return trimmed.toLowerCase().endsWith('.xml') ? trimmed : `${trimmed}.xml`
}

type Props = {
  projectId: string | null | undefined
  importId?: string | null
  fileName?: string | null
  /** When true, only the uploaded XML file is served — never a regenerated export. */
  originalOnly?: boolean
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  label?: string
}

export function ScheduleDownloadButton({
  projectId,
  importId,
  fileName,
  originalOnly = false,
  variant = 'outline',
  size = 'sm',
  className,
  label = 'دانلود برنامه XML',
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (!projectId && !importId) return
    setLoading(true)
    try {
      const originalQuery = originalOnly ? (importId ? '?original=1' : '&original=1') : ''
      const url = importId
        ? `/api/schedule/imports/${importId}/file${originalQuery}`
        : `/api/schedule/download?projectId=${encodeURIComponent(projectId!)}${originalQuery}`
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'دانلود انجام نشد')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const headerName = res.headers.get('X-File-Name')
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const downloadName = ensureXmlExtension(
        fileName ??
          (headerName ? decodeURIComponent(headerName) : null) ??
          (match ? decodeURIComponent(match[1]) : null) ??
          `schedule-${projectId ?? importId}.xml`
      )
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = downloadName
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'دانلود انجام نشد')
    } finally {
      setLoading(false)
    }
  }

  if (!projectId && !importId) return null

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      disabled={loading}
      onClick={() => void handleDownload()}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {size !== 'icon' ? label : null}
    </Button>
  )
}
