'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import type { EventType, NotificationRoute, Position } from '@/shared/types/admin'

interface NotificationRouteEditorProps {
  eventTypes: EventType[]
  positions: Position[]
  routes: NotificationRoute[]
  onSave: (payload: {
    event_type_id: string
    position_id: string
    email_enabled: boolean
    is_active: boolean
  }) => Promise<void>
  onDelete: (routeId: string) => Promise<void>
}

export function NotificationRouteEditor({
  eventTypes,
  positions,
  routes,
  onSave,
  onDelete,
}: NotificationRouteEditorProps) {
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? '')
  const [positionId, setPositionId] = useState(positions[0]?.id ?? '')
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const routeMap = useMemo(() => {
    const map = new Map<string, NotificationRoute>()
    routes.forEach((route) => {
      map.set(`${route.event_type_id}:${route.position_id}`, route)
    })
    return map
  }, [routes])

  async function handleAddRoute(e: React.FormEvent) {
    e.preventDefault()
    if (!eventTypeId || !positionId) return
    setLoading(true)
    setError(null)
    try {
      await onSave({
        event_type_id: eventTypeId,
        position_id: positionId,
        email_enabled: emailEnabled,
        is_active: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره مسیر ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  async function toggleEmail(route: NotificationRoute) {
    await onSave({
      event_type_id: route.event_type_id,
      position_id: route.position_id,
      email_enabled: !route.email_enabled,
      is_active: route.is_active,
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>افزودن مسیر اعلان</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddRoute} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="route-event">نوع رویداد</Label>
              <select
                id="route-event"
                value={eventTypeId}
                onChange={(e) => setEventTypeId(e.target.value)}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                {eventTypes.map((eventType) => (
                  <option key={eventType.id} value={eventType.id}>{eventType.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="route-position">سمت هدف</Label>
              <select
                id="route-position"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="msa-field flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>{position.title}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Checkbox
                id="route-email"
                label="ایمیل فعال"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
            </div>
            {error ? <p className="sm:col-span-2 text-sm text-destructive">{error}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading || !eventTypeId || !positionId}>
                {loading ? 'در حال ذخیره...' : 'ذخیره مسیر'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مسیرهای پیکربندی‌شده</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز مسیر اعلانی پیکربندی نشده است.</p>
          ) : (
            routes.map((route) => (
              <div key={route.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{route.event_type?.title ?? 'رویداد'}</p>
                  <p className="text-sm text-muted-foreground">
                    سمت: {route.position?.title ?? route.position_id}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    id={`route-email-${route.id}`}
                    label="ایمیل فعال"
                    checked={route.email_enabled}
                    onChange={() => toggleEmail(route)}
                  />
                  <Button variant="outline" size="sm" onClick={() => onDelete(route.id)}>
                    حذف
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ماتریس مسیریابی</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">رویداد</th>
                {positions.map((position) => (
                  <th key={position.id} className="py-2 px-2 whitespace-nowrap">{position.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventTypes.map((eventType) => (
                <tr key={eventType.id} className="border-b">
                  <td className="py-2 pr-4 font-medium">{eventType.title}</td>
                  {positions.map((position) => {
                    const route = routeMap.get(`${eventType.id}:${position.id}`)
                    return (
                      <td key={position.id} className="py-2 px-2 text-center">
                        {route ? (route.email_enabled ? 'ایمیل' : 'بی‌صدا') : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
