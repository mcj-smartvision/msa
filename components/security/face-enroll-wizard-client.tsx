'use client'

import { useEffect, useState } from 'react'
import { FaceEnrollWizardPage } from '@/components/security/face-enroll-wizard'
import { LoadingBlock, ErrorBlock } from '@/components/admin/shared'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

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
  const [projectId, setProjectId] = useState(initialProjectId)
  const [projectName, setProjectName] = useState(initialProjectName)
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch(`/api/attendance/members?projectId=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'بارگذاری اعضا ناموفق بود')
        if (!cancelled) {
          setMembers(
            (json.members ?? []).map(
              (m: { userId: string; fullName: string; email: string | null }) => ({
                userId: m.userId,
                fullName: m.fullName,
                email: m.email,
              })
            )
          )
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطای بارگذاری')
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
      {projectOptions.length > 1 ? (
        <div className="max-w-sm space-y-1.5">
          <Label>پروژه</Label>
          <Select
            value={projectId}
            onValueChange={(id) => {
              setProjectId(id)
              writeProjectCookie(id)
              setProjectName(projectOptions.find((p) => p.id === id)?.name ?? 'پروژه')
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {loading ? <LoadingBlock label="بارگذاری اعضا…" /> : null}
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
