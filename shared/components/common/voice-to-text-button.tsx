'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { cn } from '@/shared/lib/utils'

interface VoiceToTextButtonProps {
  onTranscript: (text: string) => void
  mode?: 'append' | 'replace'
  className?: string
  size?: 'sm' | 'default'
  disabled?: boolean
  autoConfirm?: boolean
  variant?: 'default' | 'outline'
  prompt?: string
}

/**
 * Record microphone → Whisper transcription → optional confirm → fill text.
 * Works wherever a text field needs voice input.
 */
export function VoiceToTextButton({
  onTranscript,
  mode = 'append',
  className,
  size = 'sm',
  disabled,
  autoConfirm = false,
  variant = 'outline',
  prompt,
}: VoiceToTextButtonProps) {
  const { locale } = useLocale()
  const fa = locale === 'fa' || locale === 'ar'
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    setPendingText(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        void transcribe(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError(fa ? 'دسترسی به میکروفون ممکن نشد.' : 'Microphone access denied.')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    setRecording(false)
  }

  async function transcribe(blob: Blob) {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('audio', blob, 'voice.webm')
      form.append('language', fa ? 'fa' : 'en')
      if (prompt?.trim()) form.append('prompt', prompt.trim())
      const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (fa ? 'ناموفق' : 'Failed'))
      const text = String(data.text ?? '').trim()
      if (autoConfirm) {
        onTranscript(text)
        return
      }
      setPendingText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : fa ? 'ناموفق' : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  function confirm() {
    if (!pendingText) return
    onTranscript(pendingText)
    setPendingText(null)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <Button
            type="button"
            size={size}
            variant={variant}
            disabled={disabled || busy}
            onClick={() => void startRecording()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Mic className="h-4 w-4 me-1" />}
            {busy
              ? fa
                ? 'در حال تبدیل…'
                : 'Transcribing…'
              : fa
                ? 'ضبط صدا'
                : 'Voice input'}
          </Button>
        ) : (
          <Button type="button" size={size} variant="destructive" onClick={stopRecording}>
            <Square className="h-3.5 w-3.5 me-1" />
            {fa ? 'توقف و تبدیل' : 'Stop & convert'}
          </Button>
        )}
        {mode === 'append' ? (
          <span className="text-[10px] text-muted-foreground">
            {fa ? 'متن به فیلد اضافه می‌شود' : 'Text will be appended'}
          </span>
        ) : null}
      </div>

      {pendingText ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-950">
            {fa ? 'متن استخراج‌شده را بررسی و در صورت نیاز اصلاح کنید:' : 'Review the transcript and edit if needed:'}
          </p>
          <textarea
            dir={fa ? 'rtl' : 'ltr'}
            rows={4}
            className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900"
            value={pendingText}
            onChange={(e) => setPendingText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!pendingText.trim()} onClick={confirm}>
              {fa ? 'تأیید و درج در متن' : 'Confirm & insert'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPendingText(null)}>
              {fa ? 'لغو' : 'Discard'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
