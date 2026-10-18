/**
 * @file shared/components/common/voice-to-text-button.tsx
 * @purpose کامپوننت UI — زیرساخت مشترک سامانه (voice-to-text-button)
 * @safe-to-edit CAREFUL
 * @affects زیرساخت مشترک سامانه
 * @depends-on shared/components/ui/button, shared/components/i18n/locale-provider, shared/lib/utils, shared/lib/i18n/chrome
 */

'use client'

import { isFaLocale } from '@/shared/lib/i18n/pick-messages'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { getChromeMessages } from '@/shared/lib/i18n/chrome'
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
  const fa = isFaLocale(locale)
  const voice = getChromeMessages(locale).voice
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
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) {
          setError(voice.noAudio)
          return
        }
        void transcribe(blob)
      }
      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        setError(voice.recordFailed)
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError(voice.micDenied)
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
      const data = (await res.json().catch(() => ({}))) as { text?: unknown; error?: string }
      if (!res.ok) throw new Error(data.error || voice.transcribeFailed)
      const text = String(data.text ?? '').trim()
      if (!text) {
        setError(voice.noSpeech)
        return
      }
      if (autoConfirm) {
        onTranscript(text)
        return
      }
      setPendingText(text)
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      setError(
        /fetch failed|Failed to fetch|NetworkError/i.test(raw)
          ? 'ارتباط با سرور قطع شد یا تبدیل صدا در دسترس نیست. اتصال اینترنت و کلید OpenAI را چک کنید.'
          : raw || voice.transcribeFailed
      )
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
            {busy ? voice.transcribing : voice.voiceInput}
          </Button>
        ) : (
          <>
            <Button type="button" size={size} variant="destructive" onClick={stopRecording}>
              <Square className="h-3.5 w-3.5 me-1" />
              {voice.stopConvert}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600" role="status">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
              </span>
              {voice.recording}
            </span>
          </>
        )}
        {mode === 'append' ? (
          <span className="text-[10px] text-muted-foreground">
            {voice.appendHint}
          </span>
        ) : null}
      </div>

      {pendingText ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-950">
            {voice.reviewHint}
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
              {voice.confirmInsert}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPendingText(null)}>
              {voice.discard}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
