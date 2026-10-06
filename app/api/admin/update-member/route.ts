import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { createServiceClient } from '@/shared/lib/supabase/service'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { updateProjectMember, fetchProjectMember } from '@/features/admin/services/admin'
import {
isDeliverableEmail,
isSiteLocalEmail,
} from '@/shared/lib/auth/login-identifier'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await isSystemAdmin(supabase, user.id)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const memberId = String(body.member_id ?? body.memberId ?? '')
    if (!memberId) {
      return NextResponse.json({ error: 'member_id required' }, { status: 400 })
    }

    const contactEmailRaw = body.contact_email ?? body.contactEmail
    const contactEmail =
      contactEmailRaw == null || String(contactEmailRaw).trim() === ''
        ? null
        : String(contactEmailRaw).trim().toLowerCase()

    if (contactEmail && !isDeliverableEmail(contactEmail)) {
      return NextResponse.json(
        { error: 'ایمیل باید واقعی باشد (مثلاً gmail.com) — نه @site.local' },
        { status: 400 }
      )
    }

    const member = await fetchProjectMember(supabase, memberId)
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Always persist contact_email + personnel_code on profile
    const personnelCodeRaw = body.personnel_code ?? body.personnelCode
    const personnelCode =
      personnelCodeRaw == null || String(personnelCodeRaw).trim() === ''
        ? null
        : String(personnelCodeRaw).trim()

    const { error: contactError } = await supabase
      .from('profiles')
      .update({ contact_email: contactEmail, personnel_code: personnelCode })
      .eq('id', member.user_id)
    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 400 })
    }

    const shouldMigrateLogin =
      Boolean(body.migrate_login ?? body.migrateLogin ?? true) &&
      Boolean(contactEmail) &&
      isSiteLocalEmail(member.email)

    if (shouldMigrateLogin && contactEmail) {
      const service = createServiceClient()
      const { error: authError } = await service.auth.admin.updateUserById(member.user_id, {
        email: contactEmail,
        email_confirm: true,
      })
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      await updateProjectMember(
        service,
        memberId,
        {
          full_name: body.full_name ?? body.fullName,
          phone: body.phone,
          is_active: body.is_active ?? body.isActive,
          position_ids: body.position_ids ?? body.positionIds,
          email: contactEmail,
        },
        user.id
      )

      await service
        .from('profiles')
        .update({ email: contactEmail, contact_email: contactEmail, personnel_code: personnelCode })
        .eq('id', member.user_id)
    } else {
      const service = createServiceClient()
      await updateProjectMember(
        service,
        memberId,
        {
          full_name: body.full_name ?? body.fullName,
          phone: body.phone,
          is_active: body.is_active ?? body.isActive,
          position_ids: body.position_ids ?? body.positionIds,
        },
        user.id
      )
    }

    const updated = await fetchProjectMember(supabase, memberId)
    return NextResponse.json({
      member: updated,
      loginMigrated: shouldMigrateLogin,
      message: shouldMigrateLogin
        ? `لاگین از این به بعد با ایمیل ${contactEmail} است`
        : 'پروفایل ذخیره شد',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
