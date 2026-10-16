/**
 * @file features/security/components/face-enroll-wizard-client.tsx
 * @purpose کامپوننت UI — امنیت و ثبت چهره (face-enroll-wizard-client)
 * @safe-to-edit CAREFUL
 * @affects امنیت و ثبت چهره
 * @depends-on features/security/components/face-enroll-wizard, features/admin/components/shared, shared/hooks/use-synced-project-id, features/security/config
 */

'use client'

import { useEffect, useState } from 'react'
import { FaceEnrollWizardPage } from '@/features/security/components/face-enroll-wizard'
import { LoadingBlock, ErrorBlock } from '@/features/admin/components/shared'
import { FACE_ENROLL_COPY } from '@/features/security/config'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'

type MemberOption = { userId: string; fullName: string; email: string | null }

export function FaceEnrollWizardClient({
  projectId: initialProjectId,
  projectName: initialProjectName,
  projectOptions,
}: {
  projectId: string
  projectName: string
  projectOptions: { id: string; name: string }[]
}) {
  const projectId = useSyncedProjectId(initialProjectId) ?? initialProjectId
  const [projectName, setProjectName] = useState(initialProjectName)
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const match = projectOptions.find((p) => p.id === projectId)
    if (match) setProjectName(match.name)
  }, [projectId, projectOptions])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch(`/api/attendance/members?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setMembers((data.members as MemberOption[]) ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : FACE_ENROLL_COPY.loadMembersFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  return (
    <div className="space-y-4">
      {loading ? <LoadingBlock label={FACE_ENROLL_COPY.loadingMembers} /> : null}
      {error ? <ErrorBlock message={error} /> : null}
      {!loading && !error ? (
        <FaceEnrollWizardPage
          key={projectId}
          projectId={projectId}
          projectName={projectName}
          members={members}
        />
      ) : null}
    </div>
  )
}
