'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { createPosition, fetchPositions, updatePosition } from '@/features/admin/services/admin'
import { PageHeader, LoadingBlock, ErrorBlock, StatusBadge } from '@/features/admin/components/shared'
import { PositionForm } from '@/features/admin/components/position-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import type { CreatePositionInput, Position } from '@/shared/types/admin'

export default function ProjectPositionsPage({ params }: { params: { projectId: string } }) {
  const supabase = useSupabase()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadPositions() {
    const data = await fetchPositions(supabase, params.projectId)
    setPositions(data)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadPositions()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری سمت‌ها ناموفق بود')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, params.projectId])

  async function handleCreate(input: CreatePositionInput) {
    await createPosition(supabase, params.projectId, input)
    await loadPositions()
  }

  async function toggleActive(position: Position) {
    await updatePosition(supabase, position.id, { is_active: !position.is_active })
    await loadPositions()
  }

  if (loading) return <LoadingBlock label="در حال بارگذاری سمت‌ها..." />
  if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="سمت‌ها"
        description="سمت‌های مخصوص پروژه را برای کنترل دسترسی و اعلان‌ها تعریف کنید."
      />

      <PositionForm submitLabel="ایجاد سمت" onSubmit={handleCreate} />

      <Card>
        <CardHeader>
          <CardTitle>سمت‌های پروژه</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز سمتی ایجاد نشده است.</p>
          ) : (
            positions.map((position) => (
              <div key={position.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{position.title}</p>
                    <StatusBadge active={position.is_active} />
                  </div>
                  <p className="text-sm text-muted-foreground">{position.key}</p>
                  {position.description ? <p className="text-sm mt-1">{position.description}</p> : null}
                </div>
                <Button variant="outline" size="sm" onClick={() => toggleActive(position)}>
                  {position.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
