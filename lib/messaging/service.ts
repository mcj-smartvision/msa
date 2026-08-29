import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { getPositionLabel } from '@/lib/i18n/position-labels'
import { assertProjectAccess, requireUser } from '@/lib/site-ops/auth'
import { SiteOpsError } from '@/lib/site-ops-domain/errors'
import type {
  CallMedia,
  MessengerAttachment,
  MessengerCall,
  MessengerContact,
  MessengerConversation,
  MessengerMessage,
} from './types'

export class MessagingError extends Error {
  constructor(
    public code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND',
    message: string
  ) {
    super(message)
    this.name = 'MessagingError'
  }
}

function primaryPosition(positions: Array<{ key?: string; title?: string }>) {
  const first = positions.find((p) => p.key) ?? positions[0]
  if (!first?.key && !first?.title) {
    return { key: null as string | null, label: 'عضو پروژه', labels: [] as string[] }
  }
  const labels = positions
    .map((p) =>
      p.key
        ? getPositionLabel({ key: p.key, title: p.title ?? p.key }, 'fa')
        : p.title ?? ''
    )
    .filter(Boolean)
  const label = first.key
    ? getPositionLabel({ key: first.key, title: first.title ?? first.key }, 'fa')
    : first.title || 'عضو پروژه'
  return { key: first.key ?? null, label, labels }
}

export async function listMessengerContacts(
  supabase: SupabaseClient,
  projectId: string
): Promise<MessengerContact[]> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  const { data, error } = await supabase
    .from('v_project_members_with_positions')
    .select('user_id, full_name, email, is_active, positions')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('full_name')

  if (error) throw new MessagingError('VALIDATION', error.message)

  return (data ?? [])
    .filter((row) => row.user_id && row.user_id !== user.id)
    .map((row) => {
      const positions = (row.positions ?? []) as Array<{ key?: string; title?: string }>
      const pos = primaryPosition(positions)
      return {
        userId: String(row.user_id),
        fullName: String(row.full_name || row.email || 'کاربر'),
        email: row.email ?? null,
        positionLabel: pos.label,
        positionKey: pos.key,
        positionLabels: pos.labels,
      }
    })
}

async function loadContactMap(
  supabase: SupabaseClient,
  projectId: string,
  userIds: string[]
): Promise<Map<string, MessengerContact>> {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase
    .from('v_project_members_with_positions')
    .select('user_id, full_name, email, positions')
    .eq('project_id', projectId)
    .in('user_id', userIds)

  const map = new Map<string, MessengerContact>()
  for (const row of data ?? []) {
    const positions = (row.positions ?? []) as Array<{ key?: string; title?: string }>
    const pos = primaryPosition(positions)
    map.set(String(row.user_id), {
      userId: String(row.user_id),
      fullName: String(row.full_name || row.email || 'کاربر'),
      email: row.email ?? null,
      positionLabel: pos.label,
      positionKey: pos.key,
      positionLabels: pos.labels,
    })
  }
  return map
}

async function findDirectConversationId(
  supabase: SupabaseClient,
  myUserId: string,
  peerUserId: string,
  projectId: string
): Promise<string | null> {
  const { data: myMemberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', myUserId)
  const myIds = (myMemberships ?? []).map((m) => m.conversation_id)
  if (myIds.length === 0) return null

  const { data: directs } = await supabase
    .from('project_conversations')
    .select('id')
    .eq('project_id', projectId)
    .eq('kind', 'direct')
    .in('id', myIds)
  const directIds = (directs ?? []).map((d) => d.id)
  if (directIds.length === 0) return null

  const { data: members } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', directIds)

  const byConv = new Map<string, string[]>()
  for (const m of members ?? []) {
    const list = byConv.get(m.conversation_id) ?? []
    list.push(m.user_id)
    byConv.set(m.conversation_id, list)
  }

  for (const [convId, users] of byConv) {
    if (users.length === 2 && users.includes(myUserId) && users.includes(peerUserId)) {
      return convId
    }
  }
  return null
}

export async function ensureProjectHub(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  // Preferred: SECURITY DEFINER RPC (migration 51) — avoids RLS chicken-and-egg
  const { data: rpcId, error: rpcErr } = await supabase.rpc(
    'ensure_project_messenger_hub',
    { p_project_id: projectId }
  )
  if (!rpcErr && rpcId) return String(rpcId)

  let hubId: string | undefined

  const hubByFlag = await supabase
    .from('project_conversations')
    .select('id')
    .eq('project_id', projectId)
    .eq('is_project_hub', true)
    .maybeSingle()

  if (!hubByFlag.error) {
    hubId = hubByFlag.data?.id
  }

  if (!hubId) {
    const { data: bySubject } = await supabase
      .from('project_conversations')
      .select('id')
      .eq('project_id', projectId)
      .eq('kind', 'group')
      .eq('subject', 'گروه پروژه — جلسات و موارد مهم')
      .maybeSingle()
    hubId = bySubject?.id
  }

  if (!hubId) {
    const insertPayload: Record<string, unknown> = {
      project_id: projectId,
      kind: 'group',
      subject: 'گروه پروژه — جلسات و موارد مهم',
      created_by: user.id,
    }
    let { data: created, error } = await supabase
      .from('project_conversations')
      .insert({ ...insertPayload, is_project_hub: true })
      .select('id')
      .single()
    if (error?.code === '42703') {
      ;({ data: created, error } = await supabase
        .from('project_conversations')
        .insert(insertPayload)
        .select('id')
        .single())
    }
    // Insert may succeed but RETURNING blocked by old RLS — re-query as creator
    if ((!created || error) && !hubId) {
      const { data: again } = await supabase
        .from('project_conversations')
        .select('id')
        .eq('project_id', projectId)
        .eq('kind', 'group')
        .eq('subject', 'گروه پروژه — جلسات و موارد مهم')
        .maybeSingle()
      hubId = again?.id
      if (!hubId && error) throw new MessagingError('VALIDATION', error.message)
    } else {
      hubId = created?.id
    }
  }

  if (!hubId) return null

  // Always enroll current user first (so hub appears in their chat list)
  await supabase.from('conversation_members').upsert(
    { conversation_id: hubId, user_id: user.id },
    { onConflict: 'conversation_id,user_id' }
  )

  const { data: members } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('is_active', true)

  const { data: existingMembers } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', hubId)

  const have = new Set((existingMembers ?? []).map((m) => m.user_id))
  have.add(user.id)
  const toAdd = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id && !have.has(id))

  if (toAdd.length > 0) {
    await supabase.from('conversation_members').insert(
      toAdd.map((user_id) => ({ conversation_id: hubId!, user_id }))
    )
  }

  return hubId
}

export async function listConversations(
  supabase: SupabaseClient,
  projectId: string
): Promise<MessengerConversation[]> {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)

  let hubId: string | null = null
  try {
    hubId = await ensureProjectHub(supabase, projectId)
  } catch {
    /* hub optional if schema not migrated */
  }

  const { data: memberships, error: memErr } = await supabase
    .from('conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)
  if (memErr) throw new MessagingError('VALIDATION', memErr.message)

  const convIds = [...new Set([
    ...(memberships ?? []).map((m) => m.conversation_id as string),
    ...(hubId ? [hubId] : []),
  ])]
  if (convIds.length === 0) return []

  const lastReadByConv = new Map(
    (memberships ?? []).map((m) => [m.conversation_id as string, m.last_read_at as string | null])
  )

  const { data: conversations, error: cErr } = await supabase
    .from('project_conversations')
    .select('*')
    .eq('project_id', projectId)
    .in('id', convIds)
    .order('updated_at', { ascending: false })
  if (cErr) throw new MessagingError('VALIDATION', cErr.message)

  const { data: allMembers } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds)

  const membersByConv = new Map<string, string[]>()
  for (const m of allMembers ?? []) {
    const list = membersByConv.get(m.conversation_id) ?? []
    list.push(m.user_id)
    membersByConv.set(m.conversation_id, list)
  }

  const peerIds = new Set<string>()
  const peersByConv = new Map<string, string>()
  for (const [convId, users] of membersByConv) {
    const others = users.filter((id) => id !== user.id)
    if (others.length === 1) {
      peersByConv.set(convId, others[0])
      peerIds.add(others[0])
    }
  }

  const contactMap = await loadContactMap(supabase, projectId, [...peerIds])

  const result: MessengerConversation[] = []
  for (const c of conversations ?? []) {
    const { data: lastRows } = await supabase
      .from('project_messages')
      .select('id, body, sender_id, created_at')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const last = lastRows?.[0] ?? null
    const lastRead = lastReadByConv.get(c.id) ?? null
    let unreadCount = 0
    if (last) {
      let q = supabase
        .from('project_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', user.id)
      if (lastRead) q = q.gt('created_at', lastRead)
      const { count } = await q
      unreadCount = count ?? 0
    }

    const memberIds = membersByConv.get(c.id) ?? []
    const isHub =
      Boolean((c as { is_project_hub?: boolean }).is_project_hub) ||
      c.subject === 'گروه پروژه — جلسات و موارد مهم'
    const peerId = peersByConv.get(c.id) ?? null

    result.push({
      id: c.id,
      projectId: c.project_id,
      kind: c.kind,
      subject: c.subject,
      updatedAt: c.updated_at,
      peer: !isHub && peerId ? contactMap.get(peerId) ?? null : null,
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            senderId: last.sender_id,
            createdAt: last.created_at,
          }
        : null,
      unreadCount,
      isProjectHub: isHub,
      memberCount: memberIds.length,
      folder: isHub ? 'hub' : 'direct',
    })
  }

  // One chat folder per person: dedupe direct DMs by peer (keep newest)
  const seenPeers = new Set<string>()
  const deduped: MessengerConversation[] = []
  for (const c of result) {
    if (c.folder === 'hub') {
      deduped.push(c)
      continue
    }
    const peerKey = c.peer?.userId
    if (!peerKey) continue
    if (seenPeers.has(peerKey)) continue
    seenPeers.add(peerKey)
    deduped.push(c)
  }

  // Hub first, then directs by updatedAt
  return deduped.sort((a, b) => {
    if (a.folder === 'hub' && b.folder !== 'hub') return -1
    if (b.folder === 'hub' && a.folder !== 'hub') return 1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export async function getOrCreateDirectConversation(
  supabase: SupabaseClient,
  projectId: string,
  peerUserId: string
) {
  const user = await requireUser(supabase)
  await assertProjectAccess(supabase, user.id, projectId)
  if (peerUserId === user.id) {
    throw new MessagingError('VALIDATION', 'نمی‌توانید با خودتان گفتگو کنید')
  }

  const admin = await isSystemAdmin(supabase, user.id)
  if (!admin) {
    const { data: peerMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', peerUserId)
      .eq('is_active', true)
      .maybeSingle()
    if (!peerMember) throw new MessagingError('NOT_FOUND', 'مخاطب در این پروژه نیست')
  }

  const existingId = await findDirectConversationId(supabase, user.id, peerUserId, projectId)
  if (existingId) {
    const list = await listConversations(supabase, projectId)
    const found = list.find((c) => c.id === existingId)
    if (found) return found
  }

  const { data: conv, error } = await supabase
    .from('project_conversations')
    .insert({
      project_id: projectId,
      kind: 'direct',
      subject: null,
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) throw new MessagingError('VALIDATION', error.message)

  const { error: memErr } = await supabase.from('conversation_members').insert([
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: peerUserId },
  ])
  if (memErr) throw new MessagingError('VALIDATION', memErr.message)

  const contactMap = await loadContactMap(supabase, projectId, [peerUserId])
  return {
    id: conv.id,
    projectId: conv.project_id,
    kind: 'direct' as const,
    subject: conv.subject,
    updatedAt: conv.updated_at,
    peer: contactMap.get(peerUserId) ?? null,
    lastMessage: null,
    unreadCount: 0,
    folder: 'direct' as const,
    isProjectHub: false,
    memberCount: 2,
  }
}

export async function forwardMessage(
  supabase: SupabaseClient,
  messageId: string,
  targetConversationId: string
) {
  const user = await requireUser(supabase)

  const { data: src, error: srcErr } = await supabase
    .from('project_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle()
  if (srcErr) throw new MessagingError('VALIDATION', srcErr.message)
  if (!src) throw new MessagingError('NOT_FOUND', 'پیام پیدا نشد')

  const { data: srcAtts } = await supabase
    .from('message_attachments')
    .select('storage_path, file_name, file_type, file_size, storage_bucket')
    .eq('message_id', messageId)

  const { data: membership } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', targetConversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) throw new MessagingError('FORBIDDEN', 'به گفتگوی مقصد دسترسی ندارید')

  const { data: targetConv } = await supabase
    .from('project_conversations')
    .select('id, project_id')
    .eq('id', targetConversationId)
    .maybeSingle()
  if (!targetConv) throw new MessagingError('NOT_FOUND', 'گفتگوی مقصد پیدا نشد')

  const forwardBody = src.body?.startsWith('↪ ') ? src.body : `↪ ${src.body || 'پیام بازارسال‌شده'}`

  const insertPayload: Record<string, unknown> = {
    conversation_id: targetConversationId,
    project_id: targetConv.project_id,
    sender_id: user.id,
    body: forwardBody,
    priority: 'normal',
    topic: 'general',
    forwarded_from_id: src.id,
  }

  let { data: msg, error } = await supabase
    .from('project_messages')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error?.code === '42703') {
    delete insertPayload.forwarded_from_id
    ;({ data: msg, error } = await supabase
      .from('project_messages')
      .insert(insertPayload)
      .select('*')
      .single())
  }
  if (error || !msg) throw new MessagingError('VALIDATION', error?.message || 'بازارسال نشد')

  if ((srcAtts ?? []).length > 0) {
    await supabase.from('message_attachments').insert(
      (srcAtts ?? []).map((a) => ({
        message_id: msg!.id,
        project_id: targetConv.project_id,
        storage_bucket: a.storage_bucket || 'message-attachments',
        storage_path: a.storage_path,
        file_name: a.file_name,
        file_type: a.file_type,
        file_size: a.file_size,
      }))
    )
  }

  return msg
}

export async function listMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<MessengerMessage[]> {
  const user = await requireUser(supabase)

  const { data: membership } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()

  const admin = await isSystemAdmin(supabase, user.id)
  if (!membership && !admin) throw new MessagingError('FORBIDDEN', 'دسترسی به این گفتگو ندارید')

  const { data: conv } = await supabase
    .from('project_conversations')
    .select('project_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) throw new MessagingError('NOT_FOUND', 'گفتگو پیدا نشد')

  type MessageRow = {
    id: string
    conversation_id: string
    sender_id: string
    body: string
    created_at: string
    forwarded_from_id?: string | null
  }

  let data: MessageRow[] | null = null
  let error: { code?: string; message: string } | null = null

  {
    const first = await supabase
      .from('project_messages')
      .select('id, conversation_id, sender_id, body, created_at, forwarded_from_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    data = (first.data as MessageRow[] | null) ?? null
    error = first.error
  }

  if (error?.code === '42703') {
    const fallback = await supabase
      .from('project_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    data = (fallback.data as MessageRow[] | null) ?? null
    error = fallback.error
  }
  if (error) throw new MessagingError('VALIDATION', error.message)

  const messageIds = (data ?? []).map((m) => m.id)
  const attachmentsByMessage = new Map<string, MessengerAttachment[]>()

  if (messageIds.length > 0) {
    const { data: atts } = await supabase
      .from('message_attachments')
      .select('*')
      .in('message_id', messageIds)

    for (const a of atts ?? []) {
      const { data: signed } = await supabase.storage
        .from(a.storage_bucket || 'message-attachments')
        .createSignedUrl(a.storage_path, 60 * 60)
      const list = attachmentsByMessage.get(a.message_id) ?? []
      list.push({
        id: a.id,
        fileName: a.file_name,
        fileType: a.file_type,
        fileSize: a.file_size != null ? Number(a.file_size) : null,
        storagePath: a.storage_path,
        url: signed?.signedUrl ?? null,
      })
      attachmentsByMessage.set(a.message_id, list)
    }
  }

  const senderIds = [...new Set((data ?? []).map((m) => m.sender_id))]
  const contactMap = await loadContactMap(supabase, conv.project_id, senderIds)

  return (data ?? []).map((m) => {
    const contact = contactMap.get(m.sender_id)
    const forwardedFromId = m.forwarded_from_id ?? null
    return {
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      senderPositionLabel: contact?.positionLabel ?? null,
      senderName: contact?.fullName ?? null,
      mine: m.sender_id === user.id,
      attachments: attachmentsByMessage.get(m.id) ?? [],
      forwardedFromId,
      isForwarded: Boolean(forwardedFromId) || String(m.body ?? '').startsWith('↪ '),
    }
  })
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  body: string,
  files: Array<{
    storagePath: string
    fileName: string
    fileType: string
    fileSize: number
  }> = []
) {
  const user = await requireUser(supabase)
  const text = body?.trim() ?? ''
  if (!text && files.length === 0) {
    throw new MessagingError('VALIDATION', 'متن یا فایل لازم است')
  }

  const { data: membership } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) throw new MessagingError('FORBIDDEN', 'دسترسی به این گفتگو ندارید')

  const { data: conv } = await supabase
    .from('project_conversations')
    .select('id, project_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) throw new MessagingError('NOT_FOUND', 'گفتگو پیدا نشد')

  const displayBody =
    text ||
    (files.length === 1
      ? files[0].fileType.startsWith('audio/')
        ? '🎤 پیام صوتی'
        : files[0].fileType.startsWith('video/')
          ? '🎬 پیام ویدیویی'
          : `📎 ${files[0].fileName}`
      : `📎 ${files.length} فایل پیوست`)

  const { data: msg, error } = await supabase
    .from('project_messages')
    .insert({
      conversation_id: conversationId,
      project_id: conv.project_id,
      sender_id: user.id,
      body: displayBody,
      priority: 'normal',
      topic: 'general',
    })
    .select('*')
    .single()
  if (error) throw new MessagingError('VALIDATION', error.message)

  if (files.length > 0) {
    const { error: attErr } = await supabase.from('message_attachments').insert(
      files.map((f) => ({
        message_id: msg.id,
        project_id: conv.project_id,
        storage_bucket: 'message-attachments',
        storage_path: f.storagePath,
        file_name: f.fileName,
        file_type: f.fileType,
        file_size: f.fileSize,
      }))
    )
    if (attErr) throw new MessagingError('VALIDATION', attErr.message)
  }

  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id)

  const senderContacts = await loadContactMap(supabase, conv.project_id, [user.id])
  const senderLabel = senderContacts.get(user.id)?.positionLabel ?? 'همکار'

  if (members && members.length > 0) {
    await supabase.from('app_notifications').insert(
      members.map((m) => ({
        user_id: m.user_id,
        project_id: conv.project_id,
        title: `پیام جدید از ${senderLabel}`,
        body: displayBody.slice(0, 160),
        notification_type: 'message',
        href: `/dashboard`,
        related_entity_type: 'conversation',
        related_entity_id: conversationId,
      }))
    )
  }

  return msg
}

export async function startCall(
  supabase: SupabaseClient,
  opts: { conversationId: string; calleeId: string; media: CallMedia }
): Promise<MessengerCall> {
  const user = await requireUser(supabase)
  const { data: conv } = await supabase
    .from('project_conversations')
    .select('id, project_id')
    .eq('id', opts.conversationId)
    .maybeSingle()
  if (!conv) throw new MessagingError('NOT_FOUND', 'گفتگو پیدا نشد')

  const { data: membership } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', opts.conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) throw new MessagingError('FORBIDDEN', 'دسترسی ندارید')

  const { data, error } = await supabase
    .from('messenger_calls')
    .insert({
      project_id: conv.project_id,
      conversation_id: opts.conversationId,
      caller_id: user.id,
      callee_id: opts.calleeId,
      media: opts.media,
      status: 'ringing',
    })
    .select('*')
    .single()
  if (error) throw new MessagingError('VALIDATION', error.message)

  const senderContacts = await loadContactMap(supabase, conv.project_id, [user.id])
  const senderLabel = senderContacts.get(user.id)?.positionLabel ?? 'همکار'
  await supabase.from('app_notifications').insert({
    user_id: opts.calleeId,
    project_id: conv.project_id,
    title: opts.media === 'video' ? `تماس تصویری از ${senderLabel}` : `تماس صوتی از ${senderLabel}`,
    body: 'برای پاسخ در پیام‌رسان باز کنید',
    notification_type: 'message',
    href: `/dashboard`,
    related_entity_type: 'messenger_call',
    related_entity_id: data.id,
  })

  return {
    id: data.id,
    projectId: data.project_id,
    conversationId: data.conversation_id,
    callerId: data.caller_id,
    calleeId: data.callee_id,
    media: data.media,
    status: data.status,
    createdAt: data.created_at,
  }
}

export async function updateCallStatus(
  supabase: SupabaseClient,
  callId: string,
  status: 'accepted' | 'ended' | 'rejected' | 'missed'
) {
  const user = await requireUser(supabase)
  const patch: Record<string, unknown> = { status }
  if (status === 'accepted') patch.answered_at = new Date().toISOString()
  if (status === 'ended' || status === 'rejected' || status === 'missed') {
    patch.ended_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('messenger_calls')
    .update(patch)
    .eq('id', callId)
    .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
    .select('*')
    .single()
  if (error) throw new MessagingError('VALIDATION', error.message)
  return data
}

export async function listIncomingRingingCalls(supabase: SupabaseClient, projectId: string) {
  const user = await requireUser(supabase)
  const { data, error } = await supabase
    .from('messenger_calls')
    .select('*')
    .eq('project_id', projectId)
    .eq('callee_id', user.id)
    .eq('status', 'ringing')
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) {
    if (error.code === '42P01') return []
    throw new MessagingError('VALIDATION', error.message)
  }
  return (data ?? []).map((d) => ({
    id: d.id,
    projectId: d.project_id,
    conversationId: d.conversation_id,
    callerId: d.caller_id,
    calleeId: d.callee_id,
    media: d.media as CallMedia,
    status: d.status,
    createdAt: d.created_at,
  }))
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string
) {
  const user = await requireUser(supabase)
  const { error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
  if (error) throw new MessagingError('VALIDATION', error.message)
  return { ok: true }
}

export async function unreadTotal(supabase: SupabaseClient, projectId: string) {
  const conversations = await listConversations(supabase, projectId)
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0)
}

/** Sum unread across every project the signed-in user can access. */
export async function unreadTotalAllProjects(supabase: SupabaseClient) {
  const user = await requireUser(supabase)
  const admin = await isSystemAdmin(supabase, user.id)

  let projectIds: string[] = []
  if (admin) {
    const { data, error } = await supabase.from('projects').select('id')
    if (error) throw new MessagingError('VALIDATION', error.message)
    projectIds = (data ?? []).map((p) => String(p.id))
  } else {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
    if (error) throw new MessagingError('VALIDATION', error.message)
    projectIds = (data ?? []).map((p) => String(p.project_id))
  }

  let total = 0
  for (const pid of projectIds) {
    try {
      total += await unreadTotal(supabase, pid)
    } catch {
      /* skip inaccessible projects */
    }
  }
  return total
}

export function messagingErrorResponse(error: unknown) {
  if (error instanceof MessagingError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  if (error instanceof SiteOpsError) {
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  const message = error instanceof Error ? error.message : 'Messaging error'
  return NextResponse.json({ error: message, code: 'VALIDATION' }, { status: 500 })
}
