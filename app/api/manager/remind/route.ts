import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { requireUser } from '@/features/site-ops/lib/auth'
import { SiteOpsError } from '@/features/site-ops/domain/errors'
import { assertManagerAccess } from '@/features/manager/lib/access'
import {
MANAGER_REMINDER_PREFIX,
PULSE_ROLES,
REMINDER_COOLDOWN_MS,
REMINDER_COPY,
isPulseKey,
} from '@/features/manager/lib/pulse-config'
import { resolveNotifyEmail } from '@/shared/lib/auth/login-identifier'
import { sendEmail } from '@/shared/lib/email/send'
import { workshopErrorResponse } from '@/features/workshop/lib/service'

type Row = Record<string, unknown>

/**
 * POST /api/manager/remind { projectId, source } — in-app notification (and email when configured)
 * to the members responsible for a stale live source.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { projectId?: string; source?: string }
    const projectId = body.projectId ?? ''
    const source = body.source
    if (!projectId || !isPulseKey(source)) throw new SiteOpsError('VALIDATION', 'پروژه یا منبع یادآوری نامعتبر است')

    const supabase = createClient()
    const user = await requireUser(supabase)
    await assertManagerAccess(supabase, user.id, projectId)

    const service = createServiceClient()
    const entityType = `${MANAGER_REMINDER_PREFIX}${source}`

    const { data: recent } = await service
      .from('app_notifications')
      .select('created_at')
      .eq('project_id', projectId)
      .eq('related_entity_type', entityType)
      .order('created_at', { ascending: false })
      .limit(1)
    const lastAt = (recent?.[0] as Row | undefined)?.created_at
    if (lastAt && Date.now() - new Date(String(lastAt)).getTime() < REMINDER_COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'برای این بخش کمتر از یک ساعت پیش یادآوری فرستاده شده است.', lastReminderAt: lastAt },
        { status: 429 }
      )
    }

    const { data: members, error } = await service
      .from('v_project_members_with_positions')
      .select('user_id, full_name, email, contact_email, positions')
      .eq('project_id', projectId)
      .eq('is_active', true)
    if (error) throw new Error(error.message)

    const rows = (members ?? []) as Row[]
    const hasKey = (row: Row, key: string) =>
      ((row.positions as Array<{ key?: string; is_active?: boolean }> | null) ?? []).some(
        (p) => p.key === key && p.is_active !== false
      )
    let recipients: Row[] = []
    for (const key of PULSE_ROLES[source]) {
      recipients = rows.filter((row) => hasKey(row, key))
      if (recipients.length) break
    }
    if (recipients.length === 0) {
      throw new SiteOpsError('NOT_FOUND', 'مسئولی برای این بخش در پروژه تعریف نشده است')
    }

    const copy = REMINDER_COPY[source]
    const href = `${copy.href}?projectId=${encodeURIComponent(projectId)}`
    const { error: insertError } = await service.from('app_notifications').insert(
      recipients.map((row) => ({
        user_id: String(row.user_id),
        project_id: projectId,
        title: copy.title,
        body: copy.body,
        notification_type: 'warning',
        href,
        related_entity_type: entityType,
        related_entity_id: null,
      }))
    )
    if (insertError) throw new Error(insertError.message)

    const emails = recipients
      .map((row) =>
        resolveNotifyEmail({
          contactEmail: (row.contact_email as string) ?? null,
          email: (row.email as string) ?? null,
        })
      )
      .filter((e): e is string => Boolean(e))

    let email: 'sent' | 'not_configured' | 'failed' | 'no_address' = 'no_address'
    if (emails.length) {
      const result = await sendEmail({ to: emails, subject: copy.title, text: `${copy.body}\n\n${request.nextUrl.origin}${href}` })
      email = result.ok ? 'sent' : 'skipped' in result && result.skipped ? 'not_configured' : 'failed'
    }

    return NextResponse.json({
      ok: true,
      recipients: recipients.map((row) => String(row.full_name || row.email || '')),
      email,
      sentAt: new Date().toISOString(),
    })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
