import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchDashboardUserContext } from '@/lib/dashboard/user-context'
import { canViewProjectDrawings, signDrawingDownload } from '@/lib/technical-office/drawings'

function guessContentType(fileName: string, header: string | null) {
  if (header && header !== 'application/octet-stream') return header
  const name = fileName.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  return header || 'application/octet-stream'
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const context = await fetchDashboardUserContext(supabase, user.id, user.email)
  if (!canViewProjectDrawings(context)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const signed = await signDrawingDownload(params.id)
    const file = await fetch(signed.url)
    if (!file.ok) {
      return NextResponse.json({ error: 'دانلود نقشه انجام نشد.' }, { status: 400 })
    }
    const bytes = await file.arrayBuffer()
    const contentType = guessContentType(signed.fileName, file.headers.get('content-type'))
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(signed.fileName)}"`,
        'X-File-Name': encodeURIComponent(signed.fileName),
        'Cache-Control': 'private, max-age=120',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'مشاهده نقشه انجام نشد.' },
      { status: 400 }
    )
  }
}
