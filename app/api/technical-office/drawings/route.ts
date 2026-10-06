import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { fetchDashboardUserContext } from '@/shared/lib/dashboard/user-context'
import {
DRAWING_MAX_BYTES,
DRAWING_MAX_FILES,
canUploadProjectDrawings,
canViewProjectDrawings,
getDrawingFormat,
listProjectDrawings,
saveDrawingToStorage,
} from '@/features/technical-office/lib/drawings'
import type { DrawingDiscipline } from '@/features/technical-office/lib/drawings-shared'

function drawingTitle(sharedTitle: string, fileName: string, total: number) {
  const base = fileName.replace(/\.(pdf|dwg)$/i, '')
  if (!sharedTitle) return base
  return total === 1 ? sharedTitle : `${sharedTitle} — ${base}`
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = request.nextUrl.searchParams.get('projectId') ?? ''
  if (!projectId) return NextResponse.json({ error: 'projectId لازم است' }, { status: 400 })

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  if (!canViewProjectDrawings(context)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const drawings = await listProjectDrawings(projectId)
    return NextResponse.json({ drawings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'بارگذاری نقشه‌ها ناموفق بود' },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  if (!canUploadProjectDrawings(context)) {
    return NextResponse.json({ error: 'فقط دفتر فنی می‌تواند نقشه آپلود کند.' }, { status: 403 })
  }

  const form = await request.formData()
  const projectId = String(form.get('projectId') ?? '').trim()
  const title = String(form.get('title') ?? '').trim()
  const disciplineRaw = String(form.get('discipline') ?? '').trim()
  const discipline: DrawingDiscipline | undefined =
    disciplineRaw === 'structure' ||
    disciplineRaw === 'architecture' ||
    disciplineRaw === 'mechanical' ||
    disciplineRaw === 'electrical' ||
    disciplineRaw === 'other'
      ? disciplineRaw
      : undefined
  const files = [...form.getAll('file'), ...form.getAll('files')].filter(
    (item): item is File => item instanceof File && item.size > 0
  )

  if (!projectId || files.length === 0) {
    return NextResponse.json({ error: 'پروژه و حداقل یک فایل لازم است.' }, { status: 400 })
  }
  if (files.length > DRAWING_MAX_FILES) {
    return NextResponse.json(
      { error: `حداکثر ${DRAWING_MAX_FILES} فایل در هر بار آپلود مجاز است.` },
      { status: 400 }
    )
  }

  const drawings = []
  const errors: string[] = []

  for (const file of files) {
    const format = getDrawingFormat(file)
    if (!format) {
      errors.push(`${file.name}: فقط PDF یا DWG پذیرفته می‌شود.`)
      continue
    }
    if (file.size > DRAWING_MAX_BYTES) {
      errors.push(`${file.name}: حجم نباید بیش از ۲۵ مگابایت باشد.`)
      continue
    }

    const safeName = file.name.replace(/[^\w.\u0600-\u06FF-]+/g, '_') || `drawing.${format}`
    try {
      drawings.push(
        await saveDrawingToStorage({
          projectId,
          title: drawingTitle(title, safeName, files.length),
          fileName: safeName,
          file,
          uploadedBy: user.id,
          discipline,
        })
      )
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'آپلود ناموفق بود.'}`)
    }
  }

  if (drawings.length === 0) {
    return NextResponse.json(
      { error: errors[0] || 'آپلود نقشه ناموفق بود.', errors },
      { status: 400 }
    )
  }

  return NextResponse.json({ drawings, errors: errors.length ? errors : undefined })
}
