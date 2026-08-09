'use client'

import { Package, Users, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrafficLight } from '@/components/supervisor/traffic-light'
import type { ResourceSummary } from '@/lib/supervisor/types'
import type { SiteSupervisorMessages } from '@/lib/i18n/site-supervisor'

interface ResourcesPanelProps {
  resources: ResourceSummary
  labels: SiteSupervisorMessages
  onRequestPurchase: () => void
}

export function ResourcesPanel({ resources, labels, onRequestPurchase }: ResourcesPanelProps) {
  const { materials, manpower, equipment } = resources
  const shortage = manpower.crews_available < manpower.crews_needed

  return (
    <div className="space-y-4">
      <h3 className="admin-section-title px-1">{labels.resources}</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              {labels.materials}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {materials.length === 0 ? (
              <p className="text-xs text-muted-foreground">انباری متصل نیست.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="py-1 text-start">نام</th>
                      <th className="py-1 text-start">{labels.stock}</th>
                      <th className="py-1 text-start">{labels.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {materials.slice(0, 6).map((m) => (
                      <tr key={m.id}>
                        <td className="py-1.5">{m.name}</td>
                        <td className="py-1.5">
                          {m.current_stock} {m.unit}
                        </td>
                        <td className="py-1.5">
                          <TrafficLight level={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={onRequestPurchase}>
              {labels.requestPurchase}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              {labels.manpower}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {manpower.crews_available} / {manpower.crews_needed}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{labels.crews}</p>
            {shortage ? (
              <Badge variant="destructive" className="mt-2">
                {manpower.shortage_note ?? 'کمبود'}
              </Badge>
            ) : (
              <Badge variant="secondary" className="mt-2">
                مناسب
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {labels.equipment}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {equipment.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{e.name}</span>
                  <Badge variant="outline">{e.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
