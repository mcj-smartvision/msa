/**
 * @file features/schedule-intelligence/components/schedule-upload.tsx
 * @purpose کامپوننت UI — تحلیل کیفیت برنامه و آپلود MSP (schedule-upload)
 * @safe-to-edit CAREFUL
 * @affects تحلیل کیفیت برنامه و آپلود MSP
 * @depends-on shared/components/ui/button, shared/components/ui/input, features/schedule/components/schedule-download-button, features/schedule-intelligence/lib/config
 */

'use client'

import { useCallback, useState } from 'react'
import { Upload, FileJson, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ScheduleDownloadButton } from '@/features/schedule/components/schedule-download-button'
import { SCHEDULE_INTELLIGENCE_COPY as copy } from '@/features/schedule-intelligence/lib/config'

interface ScheduleUploadProps {
  onAnalyzed: (xml: string, fileName: string) => void
  loading?: boolean
}

export function ScheduleUpload({ onAnalyzed, loading }: ScheduleUploadProps) {
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      if (!file.name.toLowerCase().endsWith('.xml')) {
        setError(copy.xmlOnly)
        return
      }
      try {
        const text = await file.text()
        onAnalyzed(text, file.name)
      } catch {
        setError(copy.readFailed)
      }
    },
    [onAnalyzed]
  )

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Upload className="h-8 w-8 text-primary shrink-0 mt-1" />
        <div>
          <h3 className="font-semibold text-lg">{copy.uploadTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1">{copy.uploadHint}</p>
        </div>
      </div>
      <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 cursor-pointer hover:bg-muted/30 transition-colors">
        <Input
          type="file"
          accept=".xml"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <FileJson className="h-10 w-10 text-muted-foreground" />
        <span className="text-sm font-medium">{copy.clickXml}</span>
        <span className="text-xs text-muted-foreground">{copy.anyFileName}</span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export function ExportButtons({
  onExportJson,
  onExportCsv,
  projectId,
}: {
  onExportJson: () => void
  onExportCsv: () => void
  projectId?: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {projectId ? (
        <ScheduleDownloadButton
          projectId={projectId}
          variant="outline"
          size="sm"
          label={copy.xmlProgram}
        />
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={onExportJson}>
        <FileJson className="h-4 w-4 ml-1" />
        JSON
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
        <FileSpreadsheet className="h-4 w-4 ml-1" />
        CSV
      </Button>
    </div>
  )
}
