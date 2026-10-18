/**
 * @file features/project-manager/components/pm-subcontractors-panel.tsx
 * @purpose کامپوننت UI — اتاق فرمان مدیر پروژه و کارتابل (pm-subcontractors-panel)
 * @safe-to-edit CAREFUL
 * @affects اتاق فرمان مدیر پروژه و کارتابل
 * @depends-on shared/components/ui/button, shared/components/ui/input, shared/components/ui/label, shared/components/ui/textarea, shared/components/ui/badge, shared/components/common/voice-to-text-button, features/schedule/components/schedule-date-input, features/finance/components/money-input, shared/components/i18n/locale-provider, features/schedule/hooks/use-schedule-calendar, features/project-manager/config
 */

'use client'

import { isFaLocale } from '@/shared/lib/i18n/pick-messages'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Loader2, Plus, Upload, Users } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { VoiceToTextButton } from '@/shared/components/common/voice-to-text-button'
import { ScheduleDateInput } from '@/features/schedule/components/schedule-date-input'
import { MoneyInput, parseMoneyInput } from '@/features/finance/components/money-input'
import { useLocale } from '@/shared/components/i18n/locale-provider'
import { useScheduleCalendar } from '@/features/schedule/hooks/use-schedule-calendar'
import { useSupabase } from '@/shared/hooks/use-supabase'
import { buildSubcontractHtml } from '@/features/project-manager/lib/contract-export'
import type { ProjectSubcontractor } from '@/features/project-manager/lib/subcontractor-types'
import { openPrintableHtml } from '@/features/finance/lib/expense-export'
import { PM_SUBCONTRACTORS_COPY } from '@/features/project-manager/config'
import {
createSubcontractor,
createSubcontractorContract,
fetchProjectSubcontractors,
uploadContractFile,
} from '@/features/project-manager/services/subcontractors'

interface PmSubcontractorsPanelProps {
  projectId: string
  projectName: string
  userId: string
  compact?: boolean
}

export function PmSubcontractorsPanel({
  projectId,
  projectName,
  userId,
  compact = false,
}: PmSubcontractorsPanelProps) {
  const supabase = useSupabase()
  const { locale } = useLocale()
  const { calendar } = useScheduleCalendar()
  const fa = isFaLocale(locale)
  const t = fa ? PM_SUBCONTRACTORS_COPY.fa : PM_SUBCONTRACTORS_COPY.en

  const [rows, setRows] = useState<ProjectSubcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [trade, setTrade] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [scope, setScope] = useState('')
  const [contractNo, setContractNo] = useState('')
  const [value, setValue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [standards, setStandards] = useState(t.standardsDefault)
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProjectSubcontractors(supabase, projectId)
      setRows(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t.loadFailed
      )
    } finally {
      setLoading(false)
    }
  }, [supabase, projectId, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const sub = await createSubcontractor(supabase, {
        projectId,
        name,
        trade,
        contactName: contact,
        phone,
        notes: scope,
        createdBy: userId,
      })
      const contract = await createSubcontractorContract(supabase, {
        projectId,
        subcontractorId: sub.id,
        contractNo,
        title: t.contractTitle(name),
        scopeSummary: scope,
        contractValue: parseMoneyInput(value) ?? undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        standardsNotes: standards,
        status: 'draft',
        createdBy: userId,
      })
      if (file) {
        await uploadContractFile(supabase, {
          projectId,
          contractId: contract.id,
          file,
        })
      }
      setShowForm(false)
      setName('')
      setTrade('')
      setContact('')
      setPhone('')
      setScope('')
      setContractNo('')
      setValue('')
      setFile(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  function exportContract(sub: ProjectSubcontractor) {
    const contract = sub.contracts?.[0]
    if (!contract) return
    const html = buildSubcontractHtml(projectName, sub, contract, calendar)
    openPrintableHtml(html)
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t.hint}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 me-1" />
          {t.add}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
            <p>{error}</p>
            <p className="text-muted-foreground">
              {t.missingTables}
            </p>
          </div>
        ) : null}

        {showForm ? (
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.name}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.trade}</Label>
                <Input
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  placeholder={t.tradePlaceholder}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t.contact}</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.phone}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.contractNo}</Label>
                <Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.contractValue}</Label>
                <MoneyInput value={value} onChange={setValue} />
              </div>
              <ScheduleDateInput
                label={t.start}
                valueIso={startDate}
                onChangeIso={setStartDate}
              />
              <ScheduleDateInput
                label={t.end}
                valueIso={endDate}
                onChangeIso={setEndDate}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.scope}</Label>
                <VoiceToTextButton
                  onTranscript={(text) =>
                    setScope((prev) => (prev ? `${prev}\n${text}` : text))
                  }
                />
              </div>
              <Textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.standards}</Label>
                <VoiceToTextButton
                  onTranscript={(text) =>
                    setStandards((prev) => (prev ? `${prev}\n${text}` : text))
                  }
                />
              </div>
              <Textarea rows={2} value={standards} onChange={(e) => setStandards(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.attach}</Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="button" disabled={saving || !name.trim()} onClick={() => void handleCreate()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {t.save}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t.loading}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            {t.empty}
          </p>
        ) : (
          <ul className={compact ? 'space-y-2 max-h-64 overflow-y-auto' : 'space-y-3'}>
            {rows.map((sub) => {
              const contract = sub.contracts?.[0]
              return (
                <li key={sub.id} className="rounded-lg border px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{sub.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[sub.trade, sub.contact_name, sub.phone].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {contract ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {contract.contract_no || contract.title}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {contract.status}
                          </Badge>
                          {contract.file_name ? (
                            <Badge variant="outline" className="text-[10px]">
                              📎 {contract.file_name}
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {contract ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => exportContract(sub)}>
                        <FileText className="h-3.5 w-3.5 me-1" />
                        {t.export}
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!compact ? (
          <p className="text-[11px] text-muted-foreground">
            {t.fullPagePrefix}{' '}
            <Link href="/project/subcontractors" className="text-primary underline">
              {t.fullPageLink}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}
