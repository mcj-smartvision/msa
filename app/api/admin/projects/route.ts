import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { isSystemAdmin } from '@/features/admin/lib/access'
import { createProject } from '@/features/admin/services/admin'
import type { CreateProjectInput } from '@/shared/types/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'لطفاً دوباره وارد شوید.' }, { status: 401 })
    }

    const admin = await isSystemAdmin(supabase, user.id)
    if (!admin) {
      return NextResponse.json({ error: 'دسترسی ایجاد پروژه ندارید.' }, { status: 403 })
    }

    const body = (await request.json()) as CreateProjectInput
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'نام پروژه الزامی است.' }, { status: 400 })
    }

    const project = await createProject(supabase, body)
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ذخیره پروژه ناموفق بود'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
