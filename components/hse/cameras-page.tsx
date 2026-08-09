'use client'

import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, Save } from 'lucide-react'
import { CameraConnectionCenter, type UsbBinding } from '@/components/hse/camera-connection-center'
import { HealthBadge } from '@/components/hse/badges'
import { formatDateTime } from '@/components/hse/format'
import { HsePageHeader, Panel } from '@/components/hse/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getZone, HSE_CAMERAS } from '@/lib/hse/mock-data'
import type { CameraSource, HseCamera } from '@/lib/hse/types'
import { cn } from '@/lib/utils'

const BINDINGS_KEY = 'hse_camera_usb_bindings'

const SOURCE_LABEL: Record<CameraSource, string> = {
  rtsp: 'آدرس استریم',
  onvif: 'کشف خودکار شبکه',
  nvr: 'ضبط‌کننده شبکه',
  edge_usb: 'یو‌اس‌بی یا لپ‌تاپ',
}

export function CamerasPage() {
  const [cameras, setCameras] = useState<HseCamera[]>(() =>
    HSE_CAMERAS.map((c) => ({ ...c, calibration: { ...c.calibration } }))
  )
  const [expandedId, setExpandedId] = useState<string | null>(cameras[0]?.id ?? null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [bindings, setBindings] = useState<UsbBinding[]>([])

  useEffect(() => {
    function refresh() {
      try {
        const raw = localStorage.getItem(BINDINGS_KEY)
        setBindings(raw ? (JSON.parse(raw) as UsbBinding[]) : [])
      } catch {
        setBindings([])
      }
    }
    refresh()
    const id = window.setInterval(refresh, 1500)
    return () => window.clearInterval(id)
  }, [])

  function updateCalibration(
    id: string,
    field: keyof HseCamera['calibration'],
    value: string
  ) {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== id) return cam
        const next = { ...cam.calibration }
        if (field === 'roiNotes') {
          next.roiNotes = value
        } else {
          const num = Number(value)
          next[field] = Number.isFinite(num) ? num : cam.calibration[field]
        }
        return { ...cam, calibration: next }
      })
    )
  }

  function saveCalibration(id: string) {
    const cam = cameras.find((c) => c.id === id)
    if (!cam) return
    setSavedNote(`کالیبراسیون ${cam.code} ذخیره شد (فقط نشست محلی)`)
  }

  function effectiveHealth(cam: HseCamera) {
    if (bindings.some((b) => b.hseCameraId === cam.id)) return 'online' as const
    return cam.health
  }

  return (
    <div className="space-y-4" dir="rtl" lang="fa">
      <HsePageHeader
        title="دوربین‌ها"
        description="اکنون دوربین‌های آزمایشی یو‌اس‌بی / لپ‌تاپ را وصل کنید، نقاط انتهایی مداربسته را برای لبهٔ تولید ثبت کنید و کالیبراسیون ناوگان را مدیریت کنید."
        actions={
          savedNote ? (
            <div className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
              {savedNote}
            </div>
          ) : null
        }
      />

      <CameraConnectionCenter fleet={cameras} />

      <Panel
        title="ناوگان دوربین"
        description={`${cameras.length} دستگاه برنامه‌ریزی‌شده · ${bindings.length} متصل با یو‌اس‌بی`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] tracking-wide text-slate-500">
                <th className="w-8 pb-2 pl-2 font-semibold" />
                <th className="pb-2 pl-3 font-semibold">نام</th>
                <th className="pb-2 pl-3 font-semibold">وضعیت</th>
                <th className="pb-2 pl-3 font-semibold">منبع</th>
                <th className="pb-2 pl-3 font-semibold">اتصال زنده</th>
                <th className="pb-2 pl-3 font-semibold">محل</th>
                <th className="pb-2 pl-3 font-semibold">ضربان</th>
                <th className="pb-2 pl-3 font-semibold">زون‌ها</th>
                <th className="pb-2 font-semibold">فریم بر ثانیه / وضوح</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => {
                const open = expandedId === cam.id
                const binding = bindings.find((b) => b.hseCameraId === cam.id)
                return (
                  <Fragment key={cam.id}>
                    <tr
                      className={cn(
                        'border-b border-slate-100',
                        open ? 'bg-slate-50' : 'hover:bg-slate-50/80'
                      )}
                    >
                      <td className="py-2 pl-2">
                        <button
                          type="button"
                          aria-label={open ? 'بستن کالیبراسیون' : 'باز کردن کالیبراسیون'}
                          onClick={() => setExpandedId(open ? null : cam.id)}
                          className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronLeft className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 pl-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : cam.id)}
                          className="text-right"
                        >
                          <p className="font-medium text-slate-900">{cam.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{cam.code}</p>
                        </button>
                      </td>
                      <td className="py-2 pl-3">
                        <HealthBadge value={effectiveHealth(cam)} />
                      </td>
                      <td className="py-2 pl-3 text-xs text-slate-700">
                        {binding ? SOURCE_LABEL.edge_usb : SOURCE_LABEL[cam.sourceType]}
                      </td>
                      <td className="max-w-[180px] py-2 pl-3 text-xs text-slate-700">
                        {binding ? (
                          <span className="font-medium text-emerald-700">{binding.label}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="max-w-[180px] py-2 pl-3 text-slate-700">{cam.location}</td>
                      <td className="py-2 pl-3 whitespace-nowrap text-xs tabular-nums text-slate-600">
                        {binding ? 'همین الان (یو‌اس‌بی)' : formatDateTime(cam.lastHeartbeat)}
                      </td>
                      <td className="py-2 pl-3 text-xs text-slate-700">
                        {cam.zoneIds.map((zid) => getZone(zid)?.code ?? zid).join('، ')}
                      </td>
                      <td className="py-2 tabular-nums text-slate-700">
                        {cam.fps} / {cam.resolution}
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td colSpan={9} className="px-3 py-3">
                          <div className="rounded border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                کالیبراسیون — {cam.code}
                              </p>
                              <Button size="sm" onClick={() => saveCalibration(cam.id)}>
                                <Save className="h-3.5 w-3.5" />
                                ذخیره محلی
                              </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-4">
                              <label className="space-y-1 text-xs">
                                <span className="font-medium text-slate-600">شیب (درجه)</span>
                                <Input
                                  type="number"
                                  className="h-8 text-sm"
                                  value={cam.calibration.tiltDeg}
                                  onChange={(e) =>
                                    updateCalibration(cam.id, 'tiltDeg', e.target.value)
                                  }
                                />
                              </label>
                              <label className="space-y-1 text-xs">
                                <span className="font-medium text-slate-600">چرخش افقی (درجه)</span>
                                <Input
                                  type="number"
                                  className="h-8 text-sm"
                                  value={cam.calibration.panDeg}
                                  onChange={(e) =>
                                    updateCalibration(cam.id, 'panDeg', e.target.value)
                                  }
                                />
                              </label>
                              <label className="space-y-1 text-xs">
                                <span className="font-medium text-slate-600">بزرگ‌نمایی</span>
                                <Input
                                  type="number"
                                  step="0.1"
                                  className="h-8 text-sm"
                                  value={cam.calibration.zoom}
                                  onChange={(e) =>
                                    updateCalibration(cam.id, 'zoom', e.target.value)
                                  }
                                />
                              </label>
                              <div className="sm:col-span-4">
                                <label className="space-y-1 text-xs">
                                  <span className="font-medium text-slate-600">یادداشت ناحیه مورد نظر</span>
                                  <Textarea
                                    className="min-h-[72px] text-sm"
                                    value={cam.calibration.roiNotes}
                                    onChange={(e) =>
                                      updateCalibration(cam.id, 'roiNotes', e.target.value)
                                    }
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
