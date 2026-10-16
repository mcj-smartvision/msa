/**
 * @file features/admin/components/notification-route-editor.tsx
 * @purpose کامپوننت UI — کنترل سنتر و مدیریت اعضا/پروژه (notification-route-editor)
 * @safe-to-edit CAREFUL
 * @affects کنترل سنتر و مدیریت اعضا/پروژه
 * @depends-on shared/components/ui/button, shared/components/ui/card, shared/components/ui/checkbox, shared/components/ui/label, shared/types/admin
 */


'use client'
import { ADMIN_ROUTE_EDITOR_COPY } from '@/features/admin/config'

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
      setError(err instanceof Error ? err.message : ADMIN_ROUTE_EDITOR_COPY.saveFailed)
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
          <CardTitle>{ADMIN_ROUTE_EDITOR_COPY.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddRoute} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="route-event">{ADMIN_ROUTE_EDITOR_COPY.eventType}</Label>
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
              <Label htmlFor="route-position">{ADMIN_ROUTE_EDITOR_COPY.targetPosition}</Label>
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
                label={ADMIN_ROUTE_EDITOR_COPY.emailEnabled}
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
            </div>
            {error ? <p className="sm:col-span-2 text-sm text-destructive">{error}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading || !eventTypeId || !positionId}>
                {loading ? ADMIN_ROUTE_EDITOR_COPY.saving : ADMIN_ROUTE_EDITOR_COPY.saveRoute}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ADMIN_ROUTE_EDITOR_COPY.configuredTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ADMIN_ROUTE_EDITOR_COPY.none}</p>
          ) : (
            routes.map((route) => (
              <div key={route.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{route.event_type?.title ?? ADMIN_ROUTE_EDITOR_COPY.eventFallback}</p>
                  <p className="text-sm text-muted-foreground">
                    {ADMIN_ROUTE_EDITOR_COPY.positionPrefix}
                    {route.position?.title ?? route.position_id}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    id={`route-email-${route.id}`}
                    label={ADMIN_ROUTE_EDITOR_COPY.emailEnabled}
                    checked={route.email_enabled}
                    onChange={() => toggleEmail(route)}
                  />
                  <Button variant="outline" size="sm" onClick={() => onDelete(route.id)}>
                    {ADMIN_ROUTE_EDITOR_COPY.remove}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ADMIN_ROUTE_EDITOR_COPY.matrixTitle}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">{ADMIN_ROUTE_EDITOR_COPY.eventCol}</th>
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
                        {route
                          ? route.email_enabled
                            ? ADMIN_ROUTE_EDITOR_COPY.email
                            : ADMIN_ROUTE_EDITOR_COPY.silent
                          : '—'}
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
