'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Cable,
  CheckCircle2,
  Loader2,
  Plus,
  Radio,
  Search,
  Square,
  Unplug,
} from 'lucide-react'
import { HealthBadge } from '@/components/hse/badges'
import { Panel } from '@/components/hse/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listBrowserCameras,
  openCameraStream,
  stopStream,
  type BrowserCamera,
} from '@/lib/attendance/camera'
import type { CameraSource, HseCamera } from '@/lib/hse/types'
import { cn } from '@/lib/utils'

const BINDINGS_KEY = 'hse_camera_usb_bindings'
const IP_REGISTRY_KEY = 'hse_camera_ip_registry'

export type UsbBinding = {
  hseCameraId: string
  deviceId: string
  label: string
  boundAt: string
}

export type IpRegistryEntry = {
  id: string
  name: string
  code: string
  sourceType: Exclude<CameraSource, 'edge_usb'>
  hostOrUrl: string
  location: string
  username: string
  status: 'registered' | 'awaiting_edge' | 'verified'
  createdAt: string
}

const SOURCE_LABEL: Record<Exclude<CameraSource, 'edge_usb'>, string> = {
  rtsp: 'آدرس استریم',
  onvif: 'کشف خودکار شبکه',
  nvr: 'ضبط‌کننده شبکه',
}

const IP_STATUS_LABEL: Record<IpRegistryEntry['status'], string> = {
  registered: 'ثبت‌شده',
  awaiting_edge: 'در انتظار همگام‌سازی لبه',
  verified: 'تأییدشده',
}

function loadBindings(): UsbBinding[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(BINDINGS_KEY)
    return raw ? (JSON.parse(raw) as UsbBinding[]) : []
  } catch {
    return []
  }
}

function saveBindings(rows: UsbBinding[]) {
  localStorage.setItem(BINDINGS_KEY, JSON.stringify(rows))
}

function loadIpRegistry(): IpRegistryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(IP_REGISTRY_KEY)
    return raw ? (JSON.parse(raw) as IpRegistryEntry[]) : []
  } catch {
    return []
  }
}

function saveIpRegistry(rows: IpRegistryEntry[]) {
  localStorage.setItem(IP_REGISTRY_KEY, JSON.stringify(rows))
}

type Tab = 'live' | 'ip'

export function CameraConnectionCenter({ fleet }: { fleet: HseCamera[] }) {
  const [tab, setTab] = useState<Tab>('live')
  const [devices, setDevices] = useState<BrowserCamera[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [previewOn, setPreviewOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [slotId, setSlotId] = useState(fleet[0]?.id ?? '')
  const [bindings, setBindings] = useState<UsbBinding[]>([])
  const [ipRows, setIpRows] = useState<IpRegistryEntry[]>([])

  const [ipForm, setIpForm] = useState({
    name: '',
    code: '',
    sourceType: 'rtsp' as Exclude<CameraSource, 'edge_usb'>,
    hostOrUrl: '',
    location: '',
    username: '',
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setBindings(loadBindings())
    setIpRows(loadIpRegistry())
  }, [])

  const stopPreview = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setPreviewOn(false)
  }, [])

  useEffect(() => () => stopPreview(), [stopPreview])

  async function scanDevices() {
    setScanning(true)
    setError(null)
    setNote(null)
    try {
      const list = await listBrowserCameras()
      setDevices(list)
      if (list.length === 0) {
        setError('دوربین محلی یافت نشد. اجازهٔ دسترسی مرورگر را بدهید و دوباره تلاش کنید.')
        return
      }
      const preferred =
        bindings.find((b) => b.hseCameraId === slotId)?.deviceId ??
        list[0]?.deviceId ??
        ''
      setDeviceId(preferred)
      setNote(`${list.length} دوربین محلی کشف شد — مناسب برای نمایش و راه‌اندازی اولیه.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'کشف دوربین ناموفق بود')
    } finally {
      setScanning(false)
    }
  }

  async function startPreview() {
    setBusy(true)
    setError(null)
    setNote(null)
    stopPreview()
    try {
      const stream = await openCameraStream(deviceId || null)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setPreviewOn(true)
      setNote('پیش‌نمایش زنده فعال است (لپ‌تاپ / یو‌اس‌بی). در تولید، دریافت از لبه جایگزین این مسیر می‌شود.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'باز کردن دوربین ممکن نشد')
    } finally {
      setBusy(false)
    }
  }

  function bindToSlot() {
    if (!deviceId || !slotId) {
      setError('ابتدا یک دوربین محلی و یک جایگاه دوربین ایمنی را انتخاب کنید.')
      return
    }
    const device = devices.find((d) => d.deviceId === deviceId)
    const label = device?.label || 'دوربین محلی'
    const next: UsbBinding = {
      hseCameraId: slotId,
      deviceId,
      label,
      boundAt: new Date().toISOString(),
    }
    const rows = [...bindings.filter((b) => b.hseCameraId !== slotId), next]
    setBindings(rows)
    saveBindings(rows)
    const slot = fleet.find((c) => c.id === slotId)
    setNote(`«${label}» به ${slot?.name ?? slotId} متصل شد. کارفرما این جایگاه را به‌صورت آزمایشی متصل می‌بیند.`)
    setError(null)
  }

  function unbindSlot(hseCameraId: string) {
    const rows = bindings.filter((b) => b.hseCameraId !== hseCameraId)
    setBindings(rows)
    saveBindings(rows)
    setNote('اتصال یو‌اس‌بی از جایگاه حذف شد.')
  }

  function addIpCamera(e: React.FormEvent) {
    e.preventDefault()
    if (!ipForm.name.trim() || !ipForm.hostOrUrl.trim()) {
      setError('نام و آدرس استریم / کشف خودکار شبکه (یا میزبان) الزامی است.')
      return
    }
    const row: IpRegistryEntry = {
      id: `ip-${Date.now()}`,
      name: ipForm.name.trim(),
      code: ipForm.code.trim() || `IP-${String(ipRows.length + 1).padStart(2, '0')}`,
      sourceType: ipForm.sourceType,
      hostOrUrl: ipForm.hostOrUrl.trim(),
      location: ipForm.location.trim() || 'تخصیص‌نشده',
      username: ipForm.username.trim(),
      status: 'awaiting_edge',
      createdAt: new Date().toISOString(),
    }
    const rows = [row, ...ipRows]
    setIpRows(rows)
    saveIpRegistry(rows)
    setIpForm({
      name: '',
      code: '',
      sourceType: 'rtsp',
      hostOrUrl: '',
      location: '',
      username: '',
    })
    setError(null)
    setNote(
      `${row.code} برای همگام‌سازی با لبه ثبت شد. جریان تصویر را عامل لبهٔ کارگاه می‌کشد — نه مرورگر.`
    )
  }

  function removeIp(id: string) {
    const rows = ipRows.filter((r) => r.id !== id)
    setIpRows(rows)
    saveIpRegistry(rows)
  }

  const activeBinding = bindings.find((b) => b.hseCameraId === slotId)

  return (
    <div className="space-y-4">
      <Panel
        title="مرکز اتصال دوربین"
        description="دو مسیر: یو‌اس‌بی / لپ‌تاپ برای نمایش همین حالا · ثبت دوربین‌های شبکه برای اتصال تولید از لبه."
        actions={
          note ? (
            <div className="max-w-md rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
              {note}
            </div>
          ) : null
        }
      >
        <div className="mb-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-900">مسیر الف — آزمون زنده (همین حالا)</p>
            <p className="mt-0.5">
              وب‌کم یا دوربین یو‌اس‌بی این رایانه را کشف کنید، جریان را ببینید و به یک جایگاه دوربین
              ایمنی وصل کنید تا کارفرما در نمایش، دستگاه واقعاً متصل را ببیند.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">مسیر ب — ثبت دوربین مداربسته (آماده برای لبه)</p>
            <p className="mt-0.5">
              نقاط انتهایی آدرس استریم / کشف خودکار شبکه / ضبط‌کننده شبکه را ثبت کنید. اعتبارنامه‌ها
              برای عامل لبهٔ آینده می‌مانند؛ مرکز کنترل نیت ناوگان را نشان می‌دهد بدون باز کردن جریان در مرورگر.
            </p>
          </div>
        </div>

        <div className="mb-3 flex gap-1 border-b border-slate-200 pb-2">
          <TabButton active={tab === 'live'} onClick={() => setTab('live')} icon={Radio}>
            زنده — یو‌اس‌بی / لپ‌تاپ
          </TabButton>
          <TabButton active={tab === 'ip'} onClick={() => setTab('ip')} icon={Cable}>
            ثبت دوربین شبکه / مداربسته
          </TabButton>
        </div>

        {error ? (
          <p className="mb-3 rounded border border-rose-300 bg-rose-50 px-2.5 py-2 text-xs text-rose-800">
            {error}
          </p>
        ) : null}

        {tab === 'live' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void scanDevices()} disabled={scanning}>
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  کشف دوربین‌ها
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void startPreview()}
                  disabled={busy || devices.length === 0}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  شروع پیش‌نمایش زنده
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={stopPreview} disabled={!previewOn}>
                  <Square className="h-3.5 w-3.5" />
                  توقف
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">دوربین محلی</Label>
                <Select value={deviceId || undefined} onValueChange={setDeviceId} disabled={devices.length === 0}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={devices.length ? 'انتخاب دوربین' : 'ابتدا کشف کنید'} />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">اتصال به جایگاه دوربین ایمنی</Label>
                <Select value={slotId || undefined} onValueChange={setSlotId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="انتخاب جایگاه ناوگان" />
                  </SelectTrigger>
                  <SelectContent>
                    {fleet.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={bindToSlot} disabled={!deviceId || !slotId}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  اتصال به جایگاه
                </Button>
                {activeBinding ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => unbindSlot(slotId)}>
                    <Unplug className="h-3.5 w-3.5" />
                    قطع اتصال جایگاه
                  </Button>
                ) : null}
              </div>

              {activeBinding ? (
                <p className="rounded border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs text-sky-900">
                  جایگاه به <strong>{activeBinding.label}</strong> متصل است ·{' '}
                  {new Date(activeBinding.boundAt).toLocaleString('fa-IR')}
                </p>
              ) : null}

              {bindings.length > 0 ? (
                <div className="rounded border border-slate-200">
                  <p className="border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
                    اتصالات فعال یو‌اس‌بی
                  </p>
                  <ul className="divide-y divide-slate-100 text-xs">
                    {bindings.map((b) => {
                      const slot = fleet.find((c) => c.id === b.hseCameraId)
                      return (
                        <li key={b.hseCameraId} className="flex items-center justify-between gap-2 px-2.5 py-2">
                          <span>
                            <span className="font-medium text-slate-900">{slot?.code ?? b.hseCameraId}</span>
                            <span className="text-slate-500"> ← {b.label}</span>
                          </span>
                          <HealthBadge value="online" />
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
                <span className="font-semibold tracking-wide">پیش‌نمایش زنده</span>
                <span className={previewOn ? 'text-emerald-400' : 'text-slate-500'}>
                  {previewOn ? '● سیگنال' : '○ آماده'}
                </span>
              </div>
              <div className="relative aspect-video bg-black">
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                {!previewOn ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Camera className="h-8 w-8 opacity-40" />
                    <p className="text-xs">دوربین را کشف کنید، سپس پیش‌نمایش را شروع کنید</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <form onSubmit={addIpCamera} className="space-y-3 rounded-md border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">ثبت دوربین مداربسته / شبکه</p>
              <p className="text-xs text-slate-600">
                نیت اتصال برای عامل لبه ذخیره می‌شود. مرورگر مستقیماً آدرس استریم را باز نمی‌کند —
                این رفتار به‌خاطر امنیت و پایداری عمداً طراحی شده است.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-xs sm:col-span-2">
                  <span className="font-medium text-slate-600">نام نمایشی</span>
                  <Input
                    className="h-8"
                    value={ipForm.name}
                    onChange={(e) => setIpForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="دوربین پی‌تی‌زد آپرون جنوبی"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">کد</span>
                  <Input
                    className="h-8"
                    value={ipForm.code}
                    onChange={(e) => setIpForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="دوربین-۰۹"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">منبع</span>
                  <Select
                    value={ipForm.sourceType}
                    onValueChange={(v) =>
                      setIpForm((f) => ({ ...f, sourceType: v as typeof ipForm.sourceType }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rtsp">{SOURCE_LABEL.rtsp}</SelectItem>
                      <SelectItem value="onvif">{SOURCE_LABEL.onvif}</SelectItem>
                      <SelectItem value="nvr">{SOURCE_LABEL.nvr}</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1 text-xs sm:col-span-2">
                  <span className="font-medium text-slate-600">آدرس / میزبان</span>
                  <Input
                    className="h-8 font-mono text-xs"
                    value={ipForm.hostOrUrl}
                    onChange={(e) => setIpForm((f) => ({ ...f, hostOrUrl: e.target.value }))}
                    placeholder="آدرس استریم روی شبکه داخلی کارگاه"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">محل</span>
                  <Input
                    className="h-8"
                    value={ipForm.location}
                    onChange={(e) => setIpForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="طبقه ۲ — لبه شرقی"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-600">نام کاربری (اختیاری)</span>
                  <Input
                    className="h-8"
                    value={ipForm.username}
                    onChange={(e) => setIpForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="مدیرسیستم"
                    autoComplete="off"
                  />
                </label>
              </div>
              <Button type="submit" size="sm">
                <Plus className="h-3.5 w-3.5" />
                افزودن به فهرست
              </Button>
            </form>

            <div className="rounded-md border border-slate-200">
              <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                دوربین‌های شبکه ثبت‌شده ({ipRows.length})
              </p>
              {ipRows.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-slate-500">
                  هنوز دوربین شبکه‌ای ثبت نشده است. نقاط انتهایی آدرس استریم / کشف خودکار شبکه را اضافه کنید
                  تا کارفرما مسیر تولید را از پیش تعریف‌شده ببیند.
                </p>
              ) : (
                <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto text-sm">
                  {ipRows.map((row) => (
                    <li key={row.id} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {row.name}{' '}
                            <span className="font-mono text-[11px] text-slate-500">{row.code}</span>
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-600">{row.hostOrUrl}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {SOURCE_LABEL[row.sourceType]} · {row.location} ·{' '}
                            {IP_STATUS_LABEL[row.status]}
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeIp(row.id)}>
                          حذف
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Radio
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}
