import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/admin/access'
import { createServiceClient } from '@/lib/supabase/service'
import { createProjectMember, findProfileByEmail, updateProjectMember } from '@/utils/admin'
import { normalizeLoginIdentifier, isDeliverableEmail } from '@/lib/auth/login-identifier'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isSystemAdmin(supabase, user.id)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      project_id,
      full_name,
      email,
      contact_email,
      contactEmail,
      phone,
      password,
      is_active,
      position_ids,
    } = body

    if (!project_id || !full_name || !password) {
      return NextResponse.json(
        { error: 'پروژه، نام کامل و رمز عبور الزامی است' },
        { status: 400 }
      )
    }

    const realEmail = String(contact_email ?? contactEmail ?? '').trim().toLowerCase()
    const usernameOrEmail = String(email ?? '').trim()

    if (!realEmail && !usernameOrEmail) {
      return NextResponse.json(
        { error: 'ایمیل واقعی یا نام کاربری الزامی است' },
        { status: 400 }
      )
    }

    if (realEmail && !isDeliverableEmail(realEmail)) {
      return NextResponse.json(
        { error: 'ایمیل باید واقعی باشد (مثلاً gmail.com) — نه @site.local' },
        { status: 400 }
      )
    }

    if (!Array.isArray(position_ids) || position_ids.length < 1) {
      return NextResponse.json(
        { error: 'حداقل یک نقش/سمت را انتخاب کنید' },
        { status: 400 }
      )
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }, { status: 400 })
    }

    // Prefer real email as auth login; fall back to username@site.local
    const normalizedEmail = realEmail
      ? realEmail
      : normalizeLoginIdentifier(usernameOrEmail)
    const service = createServiceClient()
    let profile = await findProfileByEmail(supabase, normalizedEmail)

    if (profile) {
      const { error: updateError } = await service.auth.admin.updateUserById(profile.id, {
        password: String(password),
        user_metadata: { full_name },
        email_confirm: true,
      })
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      await supabase
        .from('profiles')
        .update({
          is_first_login: true,
          contact_email: realEmail || null,
          full_name,
        })
        .eq('id', profile.id)
    } else {
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name },
      })

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      if (!created.user) {
        return NextResponse.json({ error: 'ساخت کاربر احراز هویت ناموفق بود' }, { status: 500 })
      }

      profile = {
        id: created.user.id,
        email: created.user.email ?? normalizedEmail,
        full_name,
      }

      await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          email: normalizedEmail,
          full_name,
          contact_email: realEmail || (isDeliverableEmail(normalizedEmail) ? normalizedEmail : null),
          is_active: true,
        })
    }

    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (existingMember) {
      // Already on this project — update role/profile instead of blocking (e.g. assign HSE).
      // Service role bypasses RLS so member_positions sync actually persists.
      const member = await updateProjectMember(
        service,
        existingMember.id,
        {
          full_name,
          phone,
          password: String(password),
          is_active: is_active ?? true,
          position_ids,
          email: normalizedEmail,
        },
        user.id
      )

      await service
        .from('profiles')
        .update({
          contact_email: realEmail || null,
          personnel_code: body.personnel_code ?? body.personnelCode ?? null,
          full_name,
        })
        .eq('id', profile.id)

      return NextResponse.json(
        {
          member,
          updated: true,
          message: 'این کاربر از قبل در پروژه بود؛ نقش و اطلاعات او به‌روز شد.',
        },
        { status: 200 }
      )
    }

    const member = await createProjectMember(
      service,
      project_id,
      profile.id,
      {
        full_name,
        email: normalizedEmail,
        contact_email: realEmail || undefined,
        phone,
        password: String(password),
        is_active: is_active ?? true,
        position_ids,
      },
      user.id
    )

    if (realEmail) {
      await service
        .from('profiles')
        .update({
          contact_email: realEmail,
          personnel_code: body.personnel_code ?? body.personnelCode ?? null,
        })
        .eq('id', profile.id)
    } else if (body.personnel_code || body.personnelCode) {
      await service
        .from('profiles')
        .update({ personnel_code: body.personnel_code ?? body.personnelCode })
        .eq('id', profile.id)
    }

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ایجاد عضو ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
