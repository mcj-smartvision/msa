import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireQcEngineUser, signRequestDrawing } from '@/lib/qc-engine/service'

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
  try {
    await requireQcEngineUser(createClient())
    const signed = await signRequestDrawing(params.id)
    const file = await fetch(signed.url)
    if (!file.ok) {
      return NextResponse.json({ error: 'دانلود نقشه درخواست انجام نشد.' }, { status: 400 })
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
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'مشاهده نقشه درخواست ناموفق بود' },
      { status }
    )
  }
}
