'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

export function VoiceVideoRecorder({
  onCapture,
}: {
  onCapture: (file: File) => void
}) {
  const [mode, setMode] = useState<'idle' | 'audio' | 'video'>('idle')
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const previewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return () => stopTracks()
  }, [])

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  async function start(kind: 'audio' | 'video') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { audio: true, video: { facingMode: 'user' } } : { audio: true }
      )
      streamRef.current = stream
      if (kind === 'video' && previewRef.current) {
        previewRef.current.srcObject = stream
        void previewRef.current.play()
      }
      chunksRef.current = []
      const mime =
        kind === 'video'
          ? MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      mediaRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime })
        const ext = kind === 'video' ? 'webm' : 'webm'
        const file = new File(
          [blob],
          kind === 'video' ? `video-${Date.now()}.${ext}` : `voice-${Date.now()}.${ext}`,
          { type: mime }
        )
        onCapture(file)
        stopTracks()
        setMode('idle')
        setSeconds(0)
      }
      recorder.start(200)
      setMode(kind)
      setSeconds(0)
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      alert('دسترسی به میکروفون/دوربین داده نشد')
    }
  }

  function stop() {
    mediaRef.current?.stop()
    mediaRef.current = null
  }

  if (mode === 'idle') {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void start('audio')}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-sky-600/80 text-white flex items-center justify-center"
          title="پیام صوتی (ویس)"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void start('video')}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-sky-600/80 text-white flex items-center justify-center"
          title="پیام ویدیویی"
        >
          <Video className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl bg-rose-500/20 border border-rose-400/30 px-2 py-1">
      {mode === 'video' && (
        <video ref={previewRef} muted playsInline className="h-10 w-10 rounded-lg object-cover bg-black" />
      )}
      <span className={cn('text-xs text-rose-100 tabular-nums min-w-[36px]', mode === 'audio' && 'animate-pulse')}>
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:
        {String(seconds % 60).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={stop}
        className="h-9 w-9 rounded-full bg-rose-500 text-white flex items-center justify-center"
        title="توقف و ارسال"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    </div>
  )
}
