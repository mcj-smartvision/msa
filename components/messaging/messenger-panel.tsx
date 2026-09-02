'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageCircle,
  Search,
  Send,
  X,
  ArrowRight,
  Users,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Phone,
  Video,
  GripVertical,
  Folder,
  Forward,
  UsersRound,
} from 'lucide-react'
import { readProjectCookie } from '@/lib/project/project-cookie'
import { createClient } from '@/lib/supabase/client'
import type {
  MessengerCall,
  MessengerContact,
  MessengerConversation,
  MessengerMessage,
} from '@/lib/messaging/types'
import { CallOverlay, IncomingCallBanner, createOutgoingCall } from '@/components/messaging/messenger-call'
import { VoiceVideoRecorder } from '@/components/messaging/media-recorder'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'
import { APP_NAME } from '@/lib/brand'

function chatTitle(c: MessengerConversation | null | undefined) {
  if (!c) return 'گفتگو'
  if (c.isProjectHub || c.folder === 'hub') return c.subject || 'گروه پروژه — جلسات و موارد مهم'
  return c.peer?.positionLabel ?? c.subject ?? 'گفتگو'
}

function chatSubtitle(c: MessengerConversation | null | undefined) {
  if (!c) return ''
  if (c.isProjectHub || c.folder === 'hub') {
    return `${c.memberCount ?? 'همه'} عضو · موارد مهم و قرار جلسات`
  }
  return c.peer?.fullName ?? ''
}

type Tab = 'chats' | 'members'

const MIN_W = 360
const MIN_H = 420
const DEFAULT_W = 920
const DEFAULT_H = 640

export function MessengerButton({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'nav' | 'fab'
  className?: string
}) {
  const { locale } = useLocale()
  const fa = locale === 'fa'
  const messengerLabel = fa ? 'پیام‌رسان' : 'Messenger'
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const sync = () => {
      const fromUrl =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('projectId')
          : null
      setProjectId(readProjectCookie() || fromUrl)
    }
    sync()
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/messaging/unread')
      const data = await res.json()
      if (res.ok) {
        const next = Number(data.unread ?? 0)
        setUnread((prev) => {
          if (next > prev) setPulse(true)
          return next
        })
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshUnread()
    const t = window.setInterval(() => void refreshUnread(), 12000)
    return () => window.clearInterval(t)
  }, [open, refreshUnread])

  // Realtime: new notifications for this user → badge
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    void supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!user) return
        channel = supabase
          .channel(`msg-badge-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'app_notifications',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              setPulse(true)
              void refreshUnread()
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'project_messages',
            },
            () => {
              void refreshUnread()
            }
          )
          .subscribe()
      })
      .catch(() => {
        /* ignore auth/realtime noise in the header badge */
      })

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [refreshUnread])

  useEffect(() => {
    if (!pulse) return
    const t = window.setTimeout(() => setPulse(false), 1800)
    return () => window.clearTimeout(t)
  }, [pulse])

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            variant === 'nav'
              ? 'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'
              : variant === 'fab'
                ? cn(
                    'relative inline-flex h-10 items-center gap-2 rounded-full px-3.5 sm:px-4 text-sm font-medium text-white',
                    'border border-sky-300/50 bg-sky-500/70 backdrop-blur-md shadow-lg shadow-sky-500/30',
                    'ring-1 ring-inset ring-sky-200/40 hover:bg-sky-500/85 transition-colors',
                    pulse && 'shadow-sky-400/50 shadow-xl'
                  )
                : cn(
                    'relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white shadow-md transition-all',
                    'bg-gradient-to-l from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-500',
                    pulse && 'ring-2 ring-rose-400 ring-offset-2 ring-offset-background scale-105'
                  ),
            className
          )}
          title={messengerLabel}
          aria-label={messengerLabel}
        >
          <MessageCircle
            className={cn(
              variant === 'fab' ? 'h-5 w-5' : 'h-4 w-4 shrink-0',
              pulse && variant === 'default' && 'animate-bounce'
            )}
          />
          {variant === 'default' || variant === 'fab' ? (
            <span className={cn(variant === 'fab' ? 'text-[13px] font-semibold' : 'hidden sm:inline')}>
              {messengerLabel}
            </span>
          ) : null}
          {variant === 'nav' ? <span className="flex-1 text-start">{messengerLabel}</span> : null}
          {unread > 0 && (
            <span
              className={cn(
                variant === 'nav'
                  ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white'
                  : variant === 'fab'
                    ? 'absolute -top-1.5 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-600 text-[10px] font-bold flex items-center justify-center px-0.5 border-2 border-white text-white shadow-sm'
                    : 'absolute -top-1.5 -start-1.5 min-w-[20px] h-[20px] rounded-full bg-red-600 text-[11px] font-bold flex items-center justify-center px-1 shadow-lg border-2 border-white text-white animate-pulse'
              )}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}

      {open &&
        createPortal(
          <MessengerPanel
            projectId={projectId}
            onClose={() => setOpen(false)}
            onUnreadChange={setUnread}
          />,
          document.body
        )}
    </>
  )
}

function MessengerPanel({
  projectId,
  onClose,
  onUnreadChange,
}: {
  projectId: string | null
  onClose: () => void
  onUnreadChange: (n: number) => void
}) {
  const [tab, setTab] = useState<Tab>('chats')
  const [contacts, setContacts] = useState<MessengerContact[]>([])
  const [conversations, setConversations] = useState<MessengerConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessengerMessage[]>([])
  const [draft, setDraft] = useState('')
  const [chatQuery, setChatQuery] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [activeCall, setActiveCall] = useState<{
    call: MessengerCall
    role: 'caller' | 'callee'
  } | null>(null)
  const [incoming, setIncoming] = useState<MessengerCall | null>(null)
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null)
  const [forwarding, setForwarding] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const resizing = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  )

  const loadLists = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const [cRes, vRes] = await Promise.all([
        fetch(`/api/messaging/contacts?projectId=${projectId}`),
        fetch(`/api/messaging/conversations?projectId=${projectId}`),
      ])
      const cData = await cRes.json()
      const vData = await vRes.json()
      if (!cRes.ok) throw new Error(cData.error || 'خطا در مخاطبین')
      if (!vRes.ok) throw new Error(vData.error || 'خطا در گفتگوها')
      setContacts(cData.contacts ?? [])
      setConversations(vData.conversations ?? [])
      onUnreadChange(Number(vData.unread ?? 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setLoading(false)
    }
  }, [projectId, onUnreadChange])

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'خطا در پیام‌ها')
    setMessages(data.messages ?? [])
  }, [])

  useEffect(() => {
    void loadLists()
  }, [loadLists])

  useEffect(() => {
    if (!activeId) return
    void loadMessages(activeId)
      .then(() => loadLists())
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'))
  }, [activeId, loadMessages, loadLists])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!activeId) return
    const t = window.setInterval(() => {
      void loadMessages(activeId).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(t)
  }, [activeId, loadMessages])

  // Incoming calls poll + realtime
  useEffect(() => {
    if (!projectId) return
    const supabase = createClient()
    const poll = async () => {
      try {
        const res = await fetch(`/api/messaging/calls?projectId=${projectId}`)
        const data = await res.json()
        if (res.ok && data.calls?.[0] && !activeCall) {
          setIncoming(data.calls[0])
        }
      } catch {
        /* ignore until migration */
      }
    }
    void poll()
    const t = window.setInterval(() => void poll(), 4000)

    const channel = supabase
      .channel(`calls-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messenger_calls',
          filter: `project_id=eq.${projectId}`,
        },
        () => void poll()
      )
      .subscribe()

    return () => {
      window.clearInterval(t)
      void supabase.removeChannel(channel)
    }
  }, [projectId, activeCall])

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    resizing.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      // Panel anchored top-start (RTL left). Dragging left/up grows.
      const dw = resizing.current.x - ev.clientX
      const dh = ev.clientY - resizing.current.y
      setSize({
        w: Math.min(Math.max(MIN_W, resizing.current.w + dw), window.innerWidth - 24),
        h: Math.min(Math.max(MIN_H, resizing.current.h + dh), window.innerHeight - 96),
      })
    }
    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  async function openChatWith(contact: MessengerContact) {
    if (!projectId) return
    setError(null)
    const res = await fetch('/api/messaging/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, peerUserId: contact.userId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'گفتگو باز نشد')
      return
    }
    await loadLists()
    setActiveId(data.conversation.id)
    setTab('chats')
  }

  async function send(extraFiles: File[] = []) {
    if (!activeId || sending) return
    const files = [...pendingFiles, ...extraFiles]
    if (!draft.trim() && files.length === 0) return
    setSending(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('body', draft)
      for (const f of files) form.append('files', f)
      const res = await fetch(`/api/messaging/conversations/${activeId}/messages`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ارسال نشد')
      setDraft('')
      setPendingFiles([])
      await loadMessages(activeId)
      await loadLists()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setSending(false)
    }
  }

  async function forwardTo(targetConversationId: string) {
    if (!forwardMessageId || forwarding) return
    setForwarding(true)
    setError(null)
    try {
      const res = await fetch('/api/messaging/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: forwardMessageId,
          targetConversationId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'بازارسال نشد — SQL ۵۰ را اجرا کنید')
      setForwardMessageId(null)
      await loadLists()
      if (activeId === targetConversationId) await loadMessages(activeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setForwarding(false)
    }
  }

  async function startCall(media: 'audio' | 'video') {
    if (!activeConversation?.peer) return
    try {
      const call = await createOutgoingCall(
        activeConversation.id,
        activeConversation.peer.userId,
        media
      )
      setActiveCall({ call, role: 'caller' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تماس شروع نشد — SQL ۴۹ را اجرا کنید')
    }
  }

  async function acceptIncoming() {
    if (!incoming) return
    await fetch(`/api/messaging/calls/${incoming.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' }),
    })
    setActiveCall({ call: { ...incoming, status: 'accepted' }, role: 'callee' })
    setActiveId(incoming.conversationId)
    setIncoming(null)
  }

  async function rejectIncoming() {
    if (!incoming) return
    await fetch(`/api/messaging/calls/${incoming.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    })
    setIncoming(null)
  }

  const filteredContacts = contacts.filter((c) => {
    const q = memberQuery.trim()
    if (!q) return true
    return (
      c.positionLabel.includes(q) ||
      c.fullName.includes(q) ||
      c.positionLabels.some((l) => l.includes(q))
    )
  })

  const filteredChats = conversations.filter((c) => {
    const q = chatQuery.trim()
    if (!q) return true
    const title = chatTitle(c)
    const name = c.peer?.fullName ?? ''
    return title.includes(q) || name.includes(q) || (c.lastMessage?.body ?? '').includes(q)
  })

  const activePeerId = activeConversation?.peer?.userId ?? null

  const hubChats = filteredChats.filter((c) => c.folder === 'hub' || c.isProjectHub)
  const directChats = filteredChats.filter((c) => c.folder !== 'hub' && !c.isProjectHub)

  const callerLabel =
    contacts.find((c) => c.userId === incoming?.callerId)?.positionLabel ??
    conversations.find((c) => c.id === incoming?.conversationId)?.peer?.positionLabel ??
    'همکار'

  const panelHeight = Math.min(
    size.h,
    typeof window !== 'undefined' ? window.innerHeight - 96 : size.h
  )
  const panelWidth = Math.min(
    size.w,
    typeof window !== 'undefined' ? window.innerWidth - 24 : size.w
  )

  return (
    <div
      className="fixed bottom-20 left-4 sm:left-5 z-[80] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-sky-900/40 border border-sky-300/50 pointer-events-auto ring-1 ring-sky-200/40 backdrop-blur-sm"
      dir="rtl"
      style={{
        width: panelWidth,
        height: panelHeight,
        maxHeight: 'calc(100vh - 6rem)',
        background:
          'linear-gradient(165deg, #bae6fd 0%, #38bdf8 15%, #2563eb 45%, #1e3a8a 75%, #0f172a 100%)',
      }}
    >
        {/* Resize: bottom-start (= راست پنل در RTL) — دور از دکمه ارسال سمت چپ */}
        <button
          type="button"
          onMouseDown={onResizeStart}
          className="absolute bottom-3 start-3 z-40 h-7 w-7 rounded-md bg-white/10 hover:bg-white/20 text-white/60 flex items-center justify-center cursor-nwse-resize"
          title="تغییر اندازه"
        >
          <GripVertical className="h-3.5 w-3.5 rotate-45" />
        </button>

        {incoming && !activeCall && (
          <IncomingCallBanner
            call={incoming}
            callerLabel={callerLabel}
            onAccept={() => void acceptIncoming()}
            onReject={() => void rejectIncoming()}
          />
        )}

        {activeCall && (
          <CallOverlay
            call={activeCall.call}
            role={activeCall.role}
            peerLabel={
              activeConversation?.peer?.positionLabel ??
              contacts.find((c) => c.userId === activeCall.call.callerId || c.userId === activeCall.call.calleeId)
                ?.positionLabel ??
              'همکار'
            }
            onClose={() => setActiveCall(null)}
          />
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-l from-sky-600/95 to-blue-900/95 border-b border-sky-300/20 shrink-0">
          {activeId ? (
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-white truncate">
              {activeConversation ? chatTitle(activeConversation) : `پیام‌رسان ${APP_NAME}`}
            </p>
            <p className="text-[11px] text-sky-200/70 truncate">
              {activeConversation
                ? chatSubtitle(activeConversation)
                : 'یک پوشه برای هر نفر · ویس · ویدیو · بازارسال'}
            </p>
          </div>
          {activeConversation?.peer && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void startCall('audio')}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-sky-600 text-white flex items-center justify-center"
                title="تماس صوتی"
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void startCall('video')}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-sky-600 text-white flex items-center justify-center"
                title="تماس تصویری"
              >
                <Video className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!projectId ? (
          <div className="flex-1 flex items-center justify-center p-6 text-sm text-white/60">
            ابتدا پروژه را از بالای صفحه انتخاب کنید.
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* اعضای پروژه — سمت راست در RTL */}
            <ProjectMembersPanel
              className="hidden sm:flex"
              contacts={filteredContacts}
              loading={loading}
              activePeerId={activePeerId}
              memberQuery={memberQuery}
              onMemberQueryChange={setMemberQuery}
              onSelect={(c) => void openChatWith(c)}
            />

            {/* ناحیه گفتگو — وسط */}
            <div
              className={cn(
                'flex-1 flex flex-col min-w-0 relative',
                !activeId && 'hidden sm:flex'
              )}
              style={{
                backgroundImage:
                  'radial-gradient(ellipse at top, rgba(56,189,248,0.15), transparent 50%), linear-gradient(180deg,#1e3a8a,#0f172a)',
              }}
            >
              {!activeId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-white/45 gap-3 p-6">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-400/40 to-blue-800/50 border border-sky-300/25 flex items-center justify-center">
                    <MessageCircle className="h-8 w-8 text-sky-200/90" />
                  </div>
                  <p className="text-sm text-white/70">یک گفتگو یا عضو انتخاب کنید</p>
                  <p className="text-xs text-center max-w-xs text-white/40">
                    از لیست اعضای پروژه در سمت راست شروع کنید
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn('flex group', m.mine ? 'justify-start' : 'justify-end')}
                      >
                        <div
                          className={cn(
                            'relative max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-md',
                            m.mine
                              ? 'bg-gradient-to-br from-sky-600 to-blue-900 rounded-be-md text-white'
                              : 'bg-blue-900/70 rounded-bs-md text-white border border-sky-400/20'
                          )}
                        >
                          {m.isForwarded && (
                            <p className="text-[10px] text-sky-200/80 mb-1 flex items-center gap-1">
                              <Forward className="h-3 w-3" />
                              بازارسال‌شده
                            </p>
                          )}
                          {!m.mine && (
                            <p className="text-[10px] text-sky-300/90 mb-0.5 font-medium">
                              {m.senderPositionLabel}
                            </p>
                          )}
                          {m.attachments?.map((a) => (
                            <AttachmentBubble key={a.id} attachment={a} />
                          ))}
                          {m.body &&
                            !m.body.startsWith('📎') &&
                            !m.body.startsWith('🎤') &&
                            !m.body.startsWith('🎬') && (
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {m.body.startsWith('↪ ') ? m.body.slice(2) : m.body}
                              </p>
                            )}
                          {(m.body?.startsWith('📎') ||
                            m.body?.startsWith('🎤') ||
                            m.body?.startsWith('🎬')) &&
                            (!m.attachments || m.attachments.length === 0) && (
                              <p className="text-white/80">{m.body}</p>
                            )}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => setForwardMessageId(m.id)}
                              className="text-[10px] text-white/45 hover:text-sky-300 inline-flex items-center gap-0.5"
                              title="بازارسال"
                            >
                              <Forward className="h-3 w-3" />
                              بازارسال
                            </button>
                            <p className="text-[10px] text-white/40 tabular-nums">
                              {new Date(m.createdAt).toLocaleTimeString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>

                  {pendingFiles.length > 0 && (
                    <div className="px-3 pb-1 flex flex-wrap gap-2">
                      {pendingFiles.map((f, i) => (
                        <span
                          key={`${f.name}-${i}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 text-white text-[11px] px-2 py-1"
                        >
                          {f.type.startsWith('image/') ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span className="max-w-[120px] truncate">{f.name}</span>
                          <button
                            type="button"
                            className="text-white/50 hover:text-white"
                            onClick={() =>
                              setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="p-3 bg-blue-950/80 border-t border-sky-300/15 flex items-end gap-2 shrink-0">
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        setPendingFiles((prev) => [...prev, ...files].slice(0, 5))
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center shrink-0"
                      title="پیوست عکس/فایل"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <VoiceVideoRecorder
                      onCapture={(file) => {
                        void send([file])
                      }}
                    />
                    <textarea
                      rows={1}
                      className="flex-1 resize-none rounded-2xl bg-blue-900/60 border border-sky-300/20 px-3 py-2.5 text-sm text-white placeholder:text-sky-100/40 focus:outline-none focus:ring-1 focus:ring-sky-400 max-h-28"
                      placeholder={
                        activeConversation?.isProjectHub
                          ? 'موارد مهم یا قرار جلسه…'
                          : 'پیام بنویسید…'
                      }
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void send()
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
                      onClick={() => void send()}
                      className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center disabled:opacity-40 hover:brightness-110 shrink-0 shadow-lg shadow-blue-900/40"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* لیست گفتگوها — سمت چپ در RTL */}
            <div
              className={cn(
                'flex flex-col border-s border-sky-300/15 bg-blue-950/40 w-full sm:w-[34%] sm:min-w-[200px] shrink-0',
                activeId && 'hidden sm:flex'
              )}
            >
              <div className="p-3 space-y-2">
                <div className="flex rounded-xl bg-blue-900/50 p-0.5 text-xs sm:hidden">
                  <button
                    type="button"
                    onClick={() => setTab('chats')}
                    className={cn(
                      'flex-1 rounded-lg py-2 font-medium transition-colors',
                      tab === 'chats'
                        ? 'bg-gradient-to-l from-sky-600 to-blue-700 text-white shadow'
                        : 'text-white/55 hover:text-white'
                    )}
                  >
                    گفتگوها
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('members')}
                    className={cn(
                      'flex-1 rounded-lg py-2 font-medium inline-flex items-center justify-center gap-1 transition-colors',
                      tab === 'members'
                        ? 'bg-gradient-to-l from-sky-600 to-blue-700 text-white shadow'
                        : 'text-white/55 hover:text-white'
                    )}
                  >
                    <Users className="h-3.5 w-3.5" />
                    اعضا
                  </button>
                </div>
                <p className="hidden sm:block text-xs font-semibold text-sky-200/90 px-1">گفتگوها</p>
                {tab === 'chats' && (
                  <div className="relative">
                    <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                    <input
                      className="w-full rounded-xl bg-blue-900/40 border border-sky-300/15 ps-8 pe-3 py-2 text-sm text-white placeholder:text-sky-100/40 focus:outline-none focus:ring-1 focus:ring-sky-400"
                      placeholder="جستجو در گفتگوها…"
                      value={chatQuery}
                      onChange={(e) => setChatQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {tab === 'members' && (
                  <ProjectMembersPanel
                    className="sm:hidden flex-1 min-h-0"
                    contacts={filteredContacts}
                    loading={loading}
                    activePeerId={activePeerId}
                    memberQuery={memberQuery}
                    onMemberQueryChange={setMemberQuery}
                    onSelect={(c) => void openChatWith(c)}
                    embedded
                  />
                )}

                {tab === 'chats' && loading && (
                  <p className="p-4 text-xs text-white/45">در حال بارگذاری…</p>
                )}
                {tab === 'chats' && error && (
                  <p className="mx-3 mb-2 rounded-xl bg-rose-500/20 text-rose-100 text-xs px-3 py-2 border border-rose-400/20">
                    {error}
                  </p>
                )}

                {tab === 'chats' && !loading && filteredChats.length === 0 && (
                  <p className="p-4 text-xs text-white/45">
                    هنوز گفتگویی نیست. از اعضای پروژه شروع کنید.
                  </p>
                )}

                {tab === 'chats' && hubChats.length > 0 && (
                  <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[10px] font-semibold text-sky-300/80 uppercase tracking-wide">
                    <UsersRound className="h-3 w-3" />
                    گروه پروژه
                  </div>
                )}
                {tab === 'chats' &&
                  hubChats.map((c) => (
                    <ChatRow
                      key={c.id}
                      conversation={c}
                      active={activeId === c.id}
                      onOpen={() => setActiveId(c.id)}
                      hub
                    />
                  ))}

                {tab === 'chats' && directChats.length > 0 && (
                  <div className="px-3 pt-3 pb-1 flex items-center gap-1.5 text-[10px] font-semibold text-white/45">
                    <Folder className="h-3 w-3" />
                    پوشه گفتگو با هر نفر
                  </div>
                )}
                {tab === 'chats' &&
                  directChats.map((c) => (
                    <ChatRow
                      key={c.id}
                      conversation={c}
                      active={activeId === c.id}
                      onOpen={() => setActiveId(c.id)}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {forwardMessageId && (
          <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-3">
            <div className="w-full max-w-sm rounded-2xl bg-blue-900 border border-sky-400/25 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Forward className="h-4 w-4 text-sky-400" />
                  بازارسال به…
                </p>
                <button
                  type="button"
                  onClick={() => setForwardMessageId(null)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {conversations
                  .filter((c) => c.id !== activeId)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={forwarding}
                      onClick={() => void forwardTo(c.id)}
                      className="w-full text-right px-4 py-3 flex gap-3 hover:bg-white/[0.06] border-b border-white/[0.04] disabled:opacity-50"
                    >
                      <Avatar
                        label={chatTitle(c)}
                        hub={c.isProjectHub || c.folder === 'hub'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{chatTitle(c)}</p>
                        <p className="text-[11px] text-white/40 truncate">{chatSubtitle(c)}</p>
                      </div>
                    </button>
                  ))}
                {conversations.filter((c) => c.id !== activeId).length === 0 && (
                  <p className="p-4 text-xs text-white/45">گفتگوی دیگری برای بازارسال نیست.</p>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

function ProjectMembersPanel({
  contacts,
  loading,
  activePeerId,
  memberQuery,
  onMemberQueryChange,
  onSelect,
  className,
  embedded,
}: {
  contacts: MessengerContact[]
  loading: boolean
  activePeerId: string | null
  memberQuery: string
  onMemberQueryChange: (q: string) => void
  onSelect: (c: MessengerContact) => void
  className?: string
  /** داخل تب موبایل — بدون هدر جدا */
  embedded?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col border-e border-sky-300/15 bg-blue-950/50 shrink-0',
        !embedded && 'w-[26%] min-w-[170px] max-w-[220px]',
        className
      )}
    >
      {!embedded && (
        <div className="px-3 pt-3 pb-2 shrink-0">
          <p className="text-xs font-semibold text-sky-200/90 flex items-center gap-1.5 mb-2">
            <Users className="h-3.5 w-3.5" />
            اعضای پروژه
          </p>
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <input
              className="w-full rounded-xl bg-blue-900/40 border border-sky-300/15 ps-8 pe-3 py-2 text-sm text-white placeholder:text-sky-100/40 focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="جستجو نام یا مسئولیت…"
              value={memberQuery}
              onChange={(e) => onMemberQueryChange(e.target.value)}
            />
          </div>
        </div>
      )}
      {embedded && (
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <input
              className="w-full rounded-xl bg-blue-900/40 border border-sky-300/15 ps-8 pe-3 py-2 text-sm text-white placeholder:text-sky-100/40 focus:outline-none focus:ring-1 focus:ring-sky-400"
              placeholder="جستجو اعضا…"
              value={memberQuery}
              onChange={(e) => onMemberQueryChange(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && <p className="p-4 text-xs text-white/45">در حال بارگذاری…</p>}
        {!loading && contacts.length === 0 && (
          <p className="p-4 text-xs text-white/45">عضوی در این پروژه نیست.</p>
        )}
        {contacts.map((c) => (
          <MemberRow
            key={c.userId}
            contact={c}
            active={activePeerId === c.userId}
            onSelect={() => onSelect(c)}
          />
        ))}
      </div>
    </div>
  )
}

function MemberRow({
  contact: c,
  active,
  onSelect,
}: {
  contact: MessengerContact
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-right px-3 py-2.5 flex gap-2.5 hover:bg-white/[0.06] border-b border-white/[0.04] transition-colors',
        active && 'bg-sky-500/20 ring-1 ring-inset ring-sky-400/30'
      )}
      title={`شروع گفتگو با ${c.fullName}`}
    >
      <Avatar label={c.positionLabel} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[13px] text-white truncate">{c.positionLabel}</p>
        <p className="text-[11px] text-white/45 truncate">{c.fullName}</p>
      </div>
      <MessageCircle className="h-4 w-4 text-sky-300/50 shrink-0 self-center" />
    </button>
  )
}

function ChatRow({
  conversation: c,
  active,
  onOpen,
  hub,
}: {
  conversation: MessengerConversation
  active: boolean
  onOpen: () => void
  hub?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full text-right px-3 py-3 flex gap-3 hover:bg-white/[0.04] border-b border-white/[0.04] transition-colors',
        active && 'bg-sky-500/15'
      )}
    >
      <Avatar label={chatTitle(c)} hub={hub} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm text-white truncate">{chatTitle(c)}</p>
          {c.unreadCount > 0 && (
            <span className="rounded-full bg-sky-500 text-[10px] font-bold px-1.5 py-0.5 text-white shadow">
              {c.unreadCount}
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/40 truncate">{chatSubtitle(c)}</p>
        <p className="text-xs text-white/55 truncate mt-0.5">{c.lastMessage?.body ?? '—'}</p>
      </div>
    </button>
  )
}

function Avatar({ label, hub }: { label: string; hub?: boolean }) {
  if (hub) {
    return (
      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shrink-0 text-white shadow-md ring-2 ring-white/10">
        <UsersRound className="h-5 w-5" />
      </div>
    )
  }
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-sky-400 to-blue-800 flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-md shadow-blue-900/30 ring-2 ring-sky-200/20">
      {initials || '؟'}
    </div>
  )
}

function AttachmentBubble({
  attachment,
}: {
  attachment: MessengerMessage['attachments'][number]
}) {
  const isImage = Boolean(attachment.fileType?.startsWith('image/') && attachment.url)
  const isAudio = Boolean(attachment.fileType?.startsWith('audio/') && attachment.url)
  const isVideo = Boolean(attachment.fileType?.startsWith('video/') && attachment.url)

  if (isImage && attachment.url) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block mb-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.fileName ?? 'تصویر'}
          className="max-w-full max-h-52 rounded-xl object-cover border border-white/10"
        />
      </a>
    )
  }
  if (isAudio && attachment.url) {
    return (
      <div className="mb-1.5 min-w-[200px]">
        <p className="text-[10px] text-sky-200/80 mb-1">🎤 پیام صوتی</p>
        <audio controls src={attachment.url} className="w-full h-9" />
      </div>
    )
  }
  if (isVideo && attachment.url) {
    return (
      <div className="mb-1.5">
        <p className="text-[10px] text-sky-200/80 mb-1">🎬 پیام ویدیویی</p>
        <video
          controls
          src={attachment.url}
          className="max-w-full max-h-56 rounded-xl border border-white/10 bg-black"
        />
      </div>
    )
  }
  return (
    <a
      href={attachment.url ?? '#'}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/10 px-2.5 py-2 mb-1.5 hover:bg-black/30"
    >
      <FileText className="h-4 w-4 shrink-0 text-sky-300" />
      <div className="min-w-0">
        <p className="text-xs truncate">{attachment.fileName ?? 'فایل'}</p>
        {attachment.fileSize != null && (
          <p className="text-[10px] text-white/45">
            {(attachment.fileSize / 1024).toFixed(0)} KB
          </p>
        )}
      </div>
    </a>
  )
}
