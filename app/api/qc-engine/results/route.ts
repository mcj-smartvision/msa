import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { requireQcEngineUser, saveChecklistVerdicts } from '@/features/qc/engine/service'
import type { QcVerdict } from '@/features/qc/engine/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { user, canWrite } = await requireQcEngineUser(supabase)
    if (!canWrite) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await request.json()
    const saved = await saveChecklistVerdicts({
      requestId: String(body.requestId ?? ''),
      itemId: String(body.itemId ?? ''),
      inspectorId: user.id,
      verdicts: Array.isArray(body.verdicts)
        ? body.verdicts.map((row: { templateItemId?: string; verdict?: QcVerdict; notes?: string }) => ({
            templateItemId: String(row.templateItemId ?? ''),
            verdict: row.verdict as QcVerdict,
            notes: row.notes,
          }))
        : [],
    })
    return NextResponse.json({ saved })
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ذخیره نتیجه ناموفق بود' },
      { status }
    )
  }
}
