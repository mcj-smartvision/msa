'use client'

import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, Pencil, XCircle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import type { AiDraftLabels, AiStatus } from '@/shared/lib/common/ai-types'

interface AiDraftViewerProps {
  text: string
  status: AiStatus
  labels: AiDraftLabels
  /** Show approve/reject when true (supervisor draft or PM pending review). */
  showActions?: boolean
  /** When true, show actions even if status is not draft_by_ai (PM review). */
  forceShowActions?: boolean
  onApprove?: (editedText: string) => void | Promise<void>
  onReject?: () => void | Promise<void>
  onRegenerate?: () => void | Promise<void>
  loading?: boolean
}

export function AiDraftViewer({
  text,
  status,
  labels,
  showActions = true,
  forceShowActions = false,
  onApprove,
  onReject,
  onRegenerate,
  loading = false,
}: AiDraftViewerProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)

  useEffect(() => {
    setDraft(text)
  }, [text])

  const isDraft = status === 'draft_by_ai'
  const canAct = showActions && (forceShowActions || isDraft) && Boolean(onApprove || onReject)
  const badgeText =
    labels.statusBadge ??
    (isDraft ? labels.draftByAi : status === 'confirmed_by_user' ? labels.confirmed : labels.reject)
  const badgeVariant = labels.statusBadge
    ? 'secondary'
    : isDraft
      ? 'secondary'
      : status === 'confirmed_by_user'
        ? 'default'
        : 'outline'

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <Badge variant={badgeVariant}>{badgeText}</Badge>
      </div>

      {labels.whatIsThis ? (
        <p className="text-xs text-muted-foreground leading-relaxed rounded-md border bg-background/70 px-3 py-2">
          {labels.whatIsThis}
        </p>
      ) : null}

      {editing ? (
        <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} className="text-sm" />
      ) : (
        <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{draft}</pre>
      )}

      {labels.destinationHint ? (
        <p className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {labels.destinationHint}
        </p>
      ) : null}

      {canAct ? (
        <div className="flex flex-wrap gap-2">
          {onApprove ? (
            <Button type="button" size="sm" disabled={loading} onClick={() => void onApprove(draft)}>
              <CheckCircle2 className="h-4 w-4" />
              {loading ? labels.saving : labels.approveSend}
            </Button>
          ) : (
            <Button type="button" size="sm" disabled>
              <CheckCircle2 className="h-4 w-4" />
              {labels.approveSend}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" />
            {labels.editText}
          </Button>
          {onRegenerate && labels.regenerate ? (
            <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void onRegenerate()}>
              {labels.regenerate}
            </Button>
          ) : null}
          {onReject ? (
            <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={() => void onReject()}>
              <XCircle className="h-4 w-4" />
              {labels.reject}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
