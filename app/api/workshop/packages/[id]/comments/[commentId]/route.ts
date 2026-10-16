/**
 * @file app/api/workshop/packages/[id]/comments/[commentId]/route.ts
 * @purpose ماژول — مسیرها و layout (route)
 * @safe-to-edit CAREFUL
 * @affects مسیرها و layout
 * @depends-on shared/lib/supabase/server, features/workshop/lib/service
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';
import { updatePackageComment, workshopErrorResponse } from '@/features/workshop/lib/service';

type Ctx = { params: { id: string; commentId: string } }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const comment = await updatePackageComment(
      supabase,
      params.commentId,
      String(body.comment ?? body.body ?? '')
    )
    return NextResponse.json({ comment })
  } catch (error) {
    return workshopErrorResponse(error)
  }
}
