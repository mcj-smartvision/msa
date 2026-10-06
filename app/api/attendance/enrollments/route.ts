import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import {
attendanceErrorResponse,
deleteEnrollment,
deleteEnrollmentSample,
enrollPerson,
listEnrollments,
updateEnrollment,
} from '@/features/attendance/lib/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    const enrollments = await listEnrollments(supabase, projectId)
    return NextResponse.json({ enrollments })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        {
          error:
            'بدنه درخواست خوانده نشد (احتمالاً حجم عکس‌ها زیاد است). دوباره «تلاش مجدد ذخیره» را بزنید.',
        },
        { status: 413 }
      )
    }
    const embeddingRaw = body.faceEmbedding ?? body.face_embedding ?? body.embedding
    const faceEmbedding = Array.isArray(embeddingRaw)
      ? embeddingRaw.map((n: unknown) => Number(n))
      : []

    const samplesRaw = Array.isArray(body.samples) ? body.samples : undefined
    const samples = samplesRaw?.map((raw: unknown) => {
      const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const embRaw = s.faceEmbedding ?? s.face_embedding
      return {
        imageBase64: String(s.imageBase64 ?? s.image_base64 ?? ''),
        faceEmbedding: Array.isArray(embRaw)
          ? embRaw.map((n: unknown) => Number(n))
          : [],
        pose: String(s.pose ?? 'straight'),
        mimeType:
          (typeof s.mimeType === 'string' && s.mimeType) ||
          (typeof s.mime_type === 'string' && s.mime_type) ||
          (typeof body.mimeType === 'string' && body.mimeType) ||
          'image/jpeg',
      }
    })

    const enrollment = await enrollPerson(supabase, {
      projectId: String(body.projectId ?? body.project_id ?? ''),
      userId: String(body.userId ?? body.user_id ?? ''),
      personName: (body.personName as string) ?? (body.person_name as string) ?? null,
      samples,
      imageBase64:
        typeof body.imageBase64 === 'string'
          ? body.imageBase64
          : typeof body.image_base64 === 'string'
            ? body.image_base64
            : undefined,
      mimeType:
        typeof body.mimeType === 'string'
          ? body.mimeType
          : typeof body.mime_type === 'string'
            ? body.mime_type
            : 'image/jpeg',
      faceEmbedding: faceEmbedding.length ? faceEmbedding : undefined,
      embeddingModel:
        typeof body.embeddingModel === 'string'
          ? body.embeddingModel
          : typeof body.embedding_model === 'string'
            ? body.embedding_model
            : undefined,
      sampleCount:
        body.sampleCount != null
          ? Number(body.sampleCount)
          : body.sample_count != null
            ? Number(body.sample_count)
            : undefined,
    })
    return NextResponse.json({ enrollment })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const projectId = String(body.projectId ?? body.project_id ?? '')
    const enrollmentId = String(body.enrollmentId ?? body.id ?? '')
    const personName = String(body.personName ?? body.person_name ?? '')
    if (!projectId || !enrollmentId) {
      return NextResponse.json({ error: 'projectId and enrollmentId required' }, { status: 400 })
    }
    const enrollment = await updateEnrollment(supabase, {
      projectId,
      enrollmentId,
      personName,
    })
    return NextResponse.json({ enrollment })
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const projectId =
      request.nextUrl.searchParams.get('projectId') ||
      request.nextUrl.searchParams.get('project_id')
    const enrollmentId =
      request.nextUrl.searchParams.get('enrollmentId') ||
      request.nextUrl.searchParams.get('id')
    const sampleId =
      request.nextUrl.searchParams.get('sampleId') ||
      request.nextUrl.searchParams.get('sample_id')

    if (!projectId || !enrollmentId) {
      return NextResponse.json({ error: 'projectId and enrollmentId required' }, { status: 400 })
    }

    if (sampleId) {
      const result = await deleteEnrollmentSample(supabase, {
        projectId,
        enrollmentId,
        sampleId,
      })
      return NextResponse.json(result)
    }

    const result = await deleteEnrollment(supabase, projectId, enrollmentId)
    return NextResponse.json(result)
  } catch (error) {
    return attendanceErrorResponse(error)
  }
}
