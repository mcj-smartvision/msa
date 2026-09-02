'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CallMedia, MessengerCall } from '@/lib/messaging/types'
import { cn } from '@/lib/utils'

type SignalPayload =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; from: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; from: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit; from: string }
  | { type: 'ready'; from: string }
  | { type: 'hangup'; from: string }

export function CallOverlay({
  call,
  role,
  peerLabel,
  onClose,
}: {
  call: MessengerCall
  role: 'caller' | 'callee'
  peerLabel: string
  onClose: () => void
}) {
  const supabase = createClient()
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(call.media === 'audio')
  const [status, setStatus] = useState(call.status)
  const [error, setError] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
  }, [])

  const hangup = useCallback(
    async (finalStatus: 'ended' | 'rejected' | 'missed' = 'ended') => {
      const channel = supabase.channel(`call-${call.id}`)
      await channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { type: 'hangup', from: userIdRef.current },
      })
      await fetch(`/api/messaging/calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus }),
      })
      cleanup()
      onClose()
    },
    [call.id, cleanup, onClose, supabase]
  )

  useEffect(() => {
    let cancelled = false
    const channel = supabase.channel(`call-${call.id}`, {
      config: { broadcast: { self: false } },
    })

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      userIdRef.current = user.id

      const media: MediaStreamConstraints =
        call.media === 'video'
          ? { audio: true, video: { facingMode: 'user' } }
          : { audio: true, video: false }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(media)
      } catch {
        setError('دسترسی به میکروفون/دوربین داده نشد')
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.ontrack = (ev) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = ev.streams[0] ?? null
        }
      }

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return
        void channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'ice',
            candidate: ev.candidate.toJSON(),
            from: user.id,
          } satisfies SignalPayload,
        })
      }

      const sendOffer = async () => {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'offer', sdp: offer, from: user.id } satisfies SignalPayload,
        })
      }

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const signal = payload as SignalPayload
        if (!signal || signal.from === user.id) return
        try {
          if (signal.type === 'ready' && role === 'caller') {
            await sendOffer()
          } else if (signal.type === 'offer') {
            await pc.setRemoteDescription(signal.sdp)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'answer', sdp: answer, from: user.id } satisfies SignalPayload,
            })
            setStatus('accepted')
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(signal.sdp)
            setStatus('accepted')
          } else if (signal.type === 'ice' && signal.candidate) {
            await pc.addIceCandidate(signal.candidate)
          } else if (signal.type === 'hangup') {
            cleanup()
            onClose()
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'خطای تماس')
        }
      })

      await channel.subscribe(async (state) => {
        if (state !== 'SUBSCRIBED' || cancelled) return
        if (role === 'caller') {
          await sendOffer()
        } else {
          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ready', from: user.id } satisfies SignalPayload,
          })
        }
      })
    }

    void setup()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
      cleanup()
    }
  }, [call.id, call.media, cleanup, onClose, role, supabase])

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMuted(!track.enabled)
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCamOff(!track.enabled)
  }

  return (
    <div className="absolute inset-0 z-20 bg-gradient-to-b from-sky-950 via-blue-950 to-slate-950 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center p-4">
        {call.media === 'video' ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-black/40"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-24 end-4 w-28 h-40 rounded-2xl object-cover border-2 border-white/30 shadow-xl bg-black/50"
            />
          </>
        ) : (
          <div className="text-center space-y-3">
            <div className="mx-auto h-24 w-24 rounded-full bg-sky-500/30 border border-sky-300/40 flex items-center justify-center">
              <Phone className="h-10 w-10 text-sky-200" />
            </div>
            <p className="text-xl font-semibold text-white">{peerLabel}</p>
            <p className="text-sm text-white/70">
              {status === 'ringing' ? 'در حال برقراری تماس…' : 'تماس صوتی فعال'}
            </p>
          </div>
        )}
        {error && (
          <p className="absolute top-4 inset-x-4 rounded-xl bg-rose-500/90 text-white text-sm px-3 py-2 text-center">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 pb-8 pt-2">
        <button
          type="button"
          onClick={toggleMute}
          className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center',
            muted ? 'bg-white text-slate-900' : 'bg-white/15 text-white'
          )}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        {call.media === 'video' && (
          <button
            type="button"
            onClick={toggleCam}
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center',
              camOff ? 'bg-white text-slate-900' : 'bg-white/15 text-white'
            )}
          >
            {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => void hangup('ended')}
          className="h-14 w-14 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

export function IncomingCallBanner({
  call,
  callerLabel,
  onAccept,
  onReject,
}: {
  call: MessengerCall
  callerLabel: string
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="absolute inset-x-3 top-3 z-30 rounded-2xl bg-blue-950/95 border border-sky-400/40 shadow-2xl px-4 py-3 flex items-center gap-3 backdrop-blur">
      <div className="h-11 w-11 rounded-full bg-sky-600 flex items-center justify-center shrink-0 animate-pulse">
        {call.media === 'video' ? (
          <Video className="h-5 w-5 text-white" />
        ) : (
          <Phone className="h-5 w-5 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{callerLabel}</p>
        <p className="text-[11px] text-white/60">
          {call.media === 'video' ? 'تماس تصویری ورودی' : 'تماس صوتی ورودی'}
        </p>
      </div>
      <button
        type="button"
        onClick={onReject}
        className="h-10 w-10 rounded-full bg-rose-500 text-white flex items-center justify-center"
      >
        <PhoneOff className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onAccept}
        className="h-10 w-10 rounded-full bg-sky-500 text-white flex items-center justify-center"
      >
        <Phone className="h-4 w-4" />
      </button>
    </div>
  )
}

export async function createOutgoingCall(
  conversationId: string,
  calleeId: string,
  media: CallMedia
): Promise<MessengerCall> {
  const res = await fetch('/api/messaging/calls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, calleeId, media }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'تماس شروع نشد')
  return data.call as MessengerCall
}
