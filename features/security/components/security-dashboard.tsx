/**
 * @file features/security/components/security-dashboard.tsx
 * @purpose کامپوننت UI — امنیت و ثبت چهره (security-dashboard)
 * @safe-to-edit CAREFUL
 * @affects امنیت و ثبت چهره
 * @depends-on features/admin/components/shared, features/admin/components/stat-card, shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/badge, shared/components/ui/select, features/attendance/lib/domain, features/attendance/lib/types, shared/hooks/use-synced-project-id, features/security/config
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
CheckCircle2,
Loader2,
LogIn,
LogOut,
Plus,
RefreshCw,
Shield,
UserX,
Users,
} from 'lucide-react'
import { PageHeader, LoadingBlock, ErrorBlock, SectionCard } from '@/features/admin/components/shared'
import { StatCard } from '@/features/admin/components/stat-card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/shared/components/ui/select'
import { formatDurationFa } from '@/features/attendance/lib/domain'
import type {
AttendanceDashboardSnapshot,
AttendanceTransit,
PresencePerson,
} from '@/features/attendance/lib/types'
import { useSyncedProjectId } from '@/shared/hooks/use-synced-project-id'
import type { DashboardUserContext } from '@/shared/types/dashboard'
import { cn } from '@/shared/lib/utils'
import { GateCameraPanel } from '@/features/security/components/gate-camera-panel'
import { SECURITY_COPY as copy } from '@/features/security/config'

interface SecurityDashboardProps {
  initialContext: DashboardUserContext
  projectOptions?: { id: string; name: string }[]
  initialProjectId?: string | null
}

type MemberOption = { userId: string; fullName: string; email: string | null }

function timeFa(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

function PresenceList({
  title,
  people,
  empty,
  accent,
}: {
  title: string
  people: PresencePerson[]
  empty: string
  accent: string
}) {
  return (
    <SectionCard title={title}>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{empty}</p>
      ) : (
        <ul className="divide-y max-h-80 overflow-y-auto">
          {people.map((p) => (
            <li key={p.userId} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {p.officialEntryAt
                    ? copy.firstEntry(timeFa(p.officialEntryAt))
                    : copy.noOfficialEntry}
                  {p.status === 'outside' && p.outsideMsToday > 0
                    ? copy.outsideDur(formatDurationFa(p.outsideMsToday))
                    : ''}
                </p>
              </div>
              <Badge variant="outline" className={cn('shrink-0', accent)}>
                {p.status === 'inside' ? copy.inside : p.status === 'outside' ? copy.outside : copy.absent}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export function SecurityDashboard({
  initialContext,
  projectOptions = [],
  initialProjectId = null,
}: SecurityDashboardProps) {
  const projectId = useSyncedProjectId(initialProjectId)
  const [snapshot, setSnapshot] = useState<AttendanceDashboardSnapshot | null>(null)
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<AttendanceTransit | null>(null)

  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedGateId, setSelectedGateId] = useState<string>('')
  const [memberQuery, setMemberQuery] = useState('')
  const [newGateName, setNewGateName] = useState('')
  const [newCameraLabel, setNewCameraLabel] = useState('')

  const projectName = useMemo(
    () => projectOptions.find((p) => p.id === projectId)?.name ?? copy.fallbackProject,
    [projectOptions, projectId]
  )

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
    )
  }, [members, memberQuery])

  const load = useCallback(async (pid: string) => {
    setLoading(true)
    setError(null)
    try {
      const [dashRes, memRes] = await Promise.all([
        fetch(`/api/attendance/dashboard?projectId=${encodeURIComponent(pid)}`),
        fetch(`/api/attendance/members?projectId=${encodeURIComponent(pid)}`),
      ])
      const dashJson = await dashRes.json()
      const memJson = await memRes.json()
      if (!dashRes.ok) throw new Error(dashJson.error || copy.loadDashFailed)
      if (!memRes.ok) throw new Error(memJson.error || copy.loadMembersFailed)
      setSnapshot(dashJson.snapshot as AttendanceDashboardSnapshot)
      setMembers(memJson.members as MemberOption[])
      const gates = (dashJson.snapshot as AttendanceDashboardSnapshot).gates
      setSelectedGateId((prev) => prev || gates.find((g) => g.isActive)?.id || gates[0]?.id || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.unknownError)
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      setSnapshot(null)
      return
    }
    void load(projectId)
    const timer = setInterval(() => {
      void load(projectId)
    }, 20000)
    return () => clearInterval(timer)
  }, [projectId, load])

  useEffect(() => {
    setSelectedUserId('')
    setSelectedGateId('')
    setFlash(null)
  }, [projectId])

  async function submitTransit(opts?: {
    identificationStatus?: 'success' | 'failed' | 'unauthorized'
    direction?: 'IN' | 'OUT'
  }) {
    if (!projectId) return
    if ((opts?.identificationStatus ?? 'success') === 'success' && !selectedUserId) {
      setError(copy.pickPerson)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/attendance/transit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: selectedUserId || null,
          gateId: selectedGateId || null,
          direction: opts?.direction ?? null,
          identificationStatus: opts?.identificationStatus ?? 'success',
          source: 'manual_guard',
          personName: members.find((m) => m.userId === selectedUserId)?.fullName ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || copy.saveFailed)
      const transit = json.transit as AttendanceTransit
      setFlash(transit)
      await load(projectId)
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  async function addGate() {
    if (!projectId || !newGateName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/attendance/gates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: newGateName.trim(),
          cameraLabel: newCameraLabel.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || copy.gateFailed)
      setNewGateName('')
      setNewCameraLabel('')
      setSelectedGateId(json.gate.id)
      await load(projectId)
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.gateFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
        <PageHeader
          title={copy.title}
          description={copy.dashDescription(projectName)}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!projectId || loading}
                onClick={() => projectId && void load(projectId)}
              >
                <RefreshCw className="h-4 w-4 ml-1" />
                {copy.refresh}
              </Button>
            </div>
          }
        />

        {!projectId ? (
          <ErrorBlock message={copy.noProject} />
        ) : loading && !snapshot ? (
          <LoadingBlock label={copy.loading} />
        ) : error && !snapshot ? (
          <ErrorBlock message={error} onRetry={() => void load(projectId)} />
        ) : snapshot ? (
          <>
            {error ? <ErrorBlock message={error} /> : null}

            {flash ? (
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 flex items-center gap-3',
                  flash.identificationStatus === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-amber-300 bg-amber-50 text-amber-950'
                )}
              >
                {flash.identificationStatus === 'success' ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                ) : (
                  <UserX className="h-6 w-6 shrink-0 text-amber-700" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">
                    {flash.identificationStatus === 'success'
                      ? flash.direction === 'IN'
                        ? copy.inRecorded
                        : copy.outRecorded
                      : copy.failRecorded}
                    {' — '}
                    {flash.personName || copy.unnamed}
                  </p>
                  <p className="text-sm opacity-80">
                    {timeFa(flash.occurredAt)}
                    {flash.gateName ? ` · ${flash.gateName}` : ''}
                    {flash.identificationStatus === 'success'
                      ? flash.emailStatus === 'sent'
                        ? copy.emailSentHint
                        : flash.emailStatus === 'skipped'
                          ? copy.emailSkippedHint
                          : flash.emailStatus === 'failed'
                            ? copy.emailFailedHint
                            : copy.emailQueuedHint
                      : ''}
                  </p>
                </div>
              </div>
            ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label={copy.kpiInside} value={String(snapshot.kpis.insideCount)} icon={Users} />
                <StatCard label={copy.kpiOutside} value={String(snapshot.kpis.outsideCount)} icon={LogOut} />
                <StatCard label={copy.kpiAbsent} value={String(snapshot.kpis.absentCount)} icon={UserX} />
                <StatCard label={copy.kpiTransit} value={String(snapshot.kpis.transitCountToday)} icon={LogIn} />
                <StatCard label={copy.kpiFailed} value={String(snapshot.kpis.failedCountToday)} icon={Shield} />
              </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2 space-y-6">
                  <GateCameraPanel
                    projectId={projectId}
                    gates={snapshot.gates}
                    selectedGateId={selectedGateId}
                    onGateChange={setSelectedGateId}
                    members={members}
                    onError={setError}
                    onEnrolled={() => void load(projectId)}
                    onTransitRecorded={(transit) => {
                      setFlash(transit)
                      void load(projectId)
                    }}
                  />

                  <SectionCard title={copy.manualTransit}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{copy.gateCamera}</Label>
                        <Select value={selectedGateId || undefined} onValueChange={setSelectedGateId}>
                          <SelectTrigger>
                            <SelectValue placeholder={copy.pickGate} />
                          </SelectTrigger>
                          <SelectContent>
                            {snapshot.gates.map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.name}
                                {g.cameraLabel ? ` — ${g.cameraLabel}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>{copy.searchByName}</Label>
                        <Input
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                          placeholder={copy.searchPlaceholder}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{copy.identifiedPerson}</Label>
                        <Select value={selectedUserId || undefined} onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder={copy.pickMember} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredMembers.map((m) => (
                              <SelectItem key={m.userId} value={m.userId}>
                                {m.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {copy.autoDirectionHint}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busy || !selectedUserId}
                          onClick={() => void submitTransit()}
                          className="min-w-[140px]"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-1" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 ml-1" />
                          )}
                          {copy.recordTransit}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy || !selectedUserId}
                          onClick={() => void submitTransit({ direction: 'IN' })}
                        >
                          <LogIn className="h-4 w-4 ml-1" />
                          {copy.forceIn}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy || !selectedUserId}
                          onClick={() => void submitTransit({ direction: 'OUT' })}
                        >
                          <LogOut className="h-4 w-4 ml-1" />
                          {copy.forceOut}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void submitTransit({ identificationStatus: 'failed' })
                          }
                        >
                          <UserX className="h-4 w-4 ml-1" />
                          {copy.notIdentified}
                        </Button>
                      </div>

                      <div className="border-t pt-4 space-y-2">
                        <Label className="text-muted-foreground">{copy.addGateCamera}</Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={newGateName}
                            onChange={(e) => setNewGateName(e.target.value)}
                            placeholder={copy.gateName}
                          />
                          <Input
                            value={newCameraLabel}
                            onChange={(e) => setNewCameraLabel(e.target.value)}
                            placeholder={copy.cameraOptional}
                          />
                          <Button type="button" variant="outline" disabled={busy} onClick={() => void addGate()}>
                            <Plus className="h-4 w-4 ml-1" />
                            {copy.add}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
              </div>

              <div className="lg:col-span-3 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <PresenceList
                      title={copy.nowInside}
                      people={snapshot.inside}
                      empty={copy.emptyInside}
                      accent="border-emerald-300 text-emerald-800"
                    />
                    <PresenceList
                      title={copy.leftToday}
                      people={snapshot.outsideToday}
                      empty={copy.emptyOutside}
                      accent="border-amber-300 text-amber-800"
                    />
                    <PresenceList
                      title={copy.absentToday}
                      people={snapshot.absent}
                      empty={copy.emptyAbsent}
                      accent="border-slate-300 text-slate-700"
                    />
                  </div>

                  <SectionCard title={copy.latest}>
                    {snapshot.recentTransits.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">{copy.noTransits}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-right text-muted-foreground border-b">
                              <th className="py-2 font-medium">{copy.colTime}</th>
                              <th className="py-2 font-medium">{copy.colName}</th>
                              <th className="py-2 font-medium">{copy.colPersonnel}</th>
                              <th className="py-2 font-medium">{copy.colDirection}</th>
                              <th className="py-2 font-medium">{copy.colGate}</th>
                              <th className="py-2 font-medium">{copy.colStatus}</th>
                              <th className="py-2 font-medium">{copy.colEmail}</th>
                              <th className="py-2 font-medium">{copy.colSend}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {snapshot.recentTransits.map((t) => (
                              <tr key={t.id} className="border-b last:border-0">
                                <td className="py-2 whitespace-nowrap">{timeFa(t.occurredAt)}</td>
                                <td className="py-2">{t.personName || '—'}</td>
                                <td className="py-2 font-mono text-xs">{t.personnelCode || '—'}</td>
                                <td className="py-2">
                                  <span
                                    className={cn(
                                      'font-medium',
                                      t.direction === 'IN' ? 'text-emerald-700' : 'text-amber-700'
                                    )}
                                  >
                                    {t.direction === 'IN' ? copy.in : copy.out}
                                  </span>
                                </td>
                                <td className="py-2">{t.gateName || '—'}</td>
                                <td className="py-2">
                                  {t.identificationStatus === 'success'
                                    ? copy.success
                                    : t.identificationStatus === 'unauthorized'
                                      ? copy.unauthorized
                                      : copy.failed}
                                </td>
                                <td className="py-2 text-xs" title={t.emailError || undefined}>
                                  {t.personEmail || (
                                    <span className="text-muted-foreground">{copy.emailNotSet}</span>
                                  )}
                                </td>
                                <td className="py-2 text-xs text-muted-foreground" title={t.emailError || undefined}>
                                  {t.emailStatus === 'sent'
                                    ? copy.emailSent
                                    : t.emailStatus === 'skipped'
                                      ? copy.emailSkipped
                                      : t.emailStatus === 'failed'
                                        ? copy.emailError
                                        : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </SectionCard>
              </div>
            </div>
          </>
        ) : null}
    </div>
  )
}
