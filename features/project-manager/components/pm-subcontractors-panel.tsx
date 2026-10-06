'use client'

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
  const fa = locale === 'fa' || locale === 'ar'

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
  const [standards, setStandards] = useState(
    fa
      ? 'رعایت نقشه‌ها، مشخصات فنی، HSE کارگاه و برنامه زمان‌بندی ابلاغی.'
      : 'Follow drawings, specs, site HSE, and issued schedule.'
  )
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
          : fa
            ? 'بارگذاری پیمانکاران ناموفق بود. آیا migration 42 اجرا شده؟'
            : 'Failed to load subcontractors. Run migration 42?'
      )
    } finally {
      setLoading(false)
    }
  }, [supabase, projectId, fa])

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
        title: fa ? `قرارداد ${name}` : `Contract — ${name}`,
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
      setError(err instanceof Error ? err.message : fa ? 'ذخیره ناموفق بود' : 'Save failed')
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
            {fa ? 'پیمانکاران پروژه' : 'Project subcontractors'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {fa
              ? 'معرفی پیمانکار، ضمیمه قرارداد و خروجی استاندارد — قبل از ابلاغ دستور لازم است.'
              : 'Register subcontractors, attach contracts, export standard summary — required before releasing instructions.'}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 me-1" />
          {fa ? 'پیمانکار جدید' : 'Add subcontractor'}
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
            <p>{error}</p>
            <p className="text-muted-foreground">
              {fa
                ? 'اگر جدول وجود ندارد: فایل database/42-project-subcontractors.sql را در Supabase اجرا کنید.'
                : 'If tables are missing: run database/42-project-subcontractors.sql in Supabase.'}
            </p>
          </div>
        ) : null}

        {showForm ? (
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{fa ? 'نام پیمانکار *' : 'Name *'}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{fa ? 'رشته / تخصص' : 'Trade'}</Label>
                <Input
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  placeholder={fa ? 'مثلاً سرامیک، اسکلت، تأسیسات' : 'e.g. tiling, structure'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{fa ? 'نماینده' : 'Contact'}</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{fa ? 'تلفن' : 'Phone'}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{fa ? 'شماره قرارداد' : 'Contract no.'}</Label>
                <Input value={contractNo} onChange={(e) => setContractNo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{fa ? 'مبلغ قرارداد (ریال)' : 'Contract value'}</Label>
                <MoneyInput value={value} onChange={setValue} />
              </div>
              <ScheduleDateInput
                label={fa ? 'شروع قرارداد' : 'Start'}
                valueIso={startDate}
                onChangeIso={setStartDate}
              />
              <ScheduleDateInput
                label={fa ? 'پایان قرارداد' : 'End'}
                valueIso={endDate}
                onChangeIso={setEndDate}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{fa ? 'محدوده کار / کلیات' : 'Scope summary'}</Label>
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
                <Label>{fa ? 'استانداردها و الزامات' : 'Standards'}</Label>
                <VoiceToTextButton
                  onTranscript={(text) =>
                    setStandards((prev) => (prev ? `${prev}\n${text}` : text))
                  }
                />
              </div>
              <Textarea rows={2} value={standards} onChange={(e) => setStandards(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{fa ? 'ضمیمه قرارداد (PDF/تصویر)' : 'Attach contract file'}</Label>
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="button" disabled={saving || !name.trim()} onClick={() => void handleCreate()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Upload className="h-4 w-4 me-1" />}
              {fa ? 'ثبت پیمانکار و قرارداد' : 'Save subcontractor & contract'}
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{fa ? 'در حال بارگذاری…' : 'Loading…'}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            {fa
              ? 'هنوز هیچ پیمانکاری معرفی نشده. تا وقتی پیمانکار ثبت نشود، نمی‌توان دستور کار را «ارسال به پیمانکار» کرد.'
              : 'No subcontractors registered yet. You cannot “send to subcontractor” until one is registered.'}
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
                        {fa ? 'خروجی استاندارد' : 'Export'}
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
            {fa ? (
              <>
                صفحه کامل:{' '}
                <Link href="/project/subcontractors" className="text-primary underline">
                  مدیریت پیمانکاران
                </Link>
              </>
            ) : (
              <>
                Full page:{' '}
                <Link href="/project/subcontractors" className="text-primary underline">
                  Subcontractors
                </Link>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  )
}
