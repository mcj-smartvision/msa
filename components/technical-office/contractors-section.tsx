'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Building2,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScheduleDateInput } from '@/components/schedule/schedule-date-input'
import { useSupabase } from '@/hooks/useSupabase'
import type { ProjectSubcontractor } from '@/lib/project-manager/subcontractor-types'
import {
  createSubcontractor,
  createSubcontractorContract,
  fetchProjectSubcontractors,
  updateSubcontractorContractIdentity,
  updateSubcontractorIdentity,
  uploadContractFile,
} from '@/utils/project-manager/subcontractors'
import { ContractorActivitiesPanel } from './contractor-activities-panel'

export function ContractorsSection({ projectId }: { projectId: string }) {
  const supabase = useSupabase()
  const [rows, setRows] = useState<ProjectSubcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contractNo, setContractNo] = useState('')
  const [contractDate, setContractDate] = useState('')
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editCompanyName, setEditCompanyName] = useState('')
  const [editContractNo, setEditContractNo] = useState('')
  const [editContractDate, setEditContractDate] = useState('')
  const [editContractFile, setEditContractFile] = useState<File | null>(null)
  const [activitiesContractorId, setActivitiesContractorId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchProjectSubcontractors(supabase, projectId))
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'بارگذاری پیمانکاران ناموفق بود'
      )
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !companyName.trim() ||
      !contractNo.trim() ||
      !contractDate
    ) {
      setError('همه فیلدهای مشخصات و تاریخ قرارداد الزامی هستند.')
      return
    }
    if (!contractFile) {
      setError('فایل قرارداد را انتخاب کنید.')
      return
    }
    if (
      contractFile.type !== 'application/pdf' &&
      !contractFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('فایل قرارداد باید با فرمت PDF باشد.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const managerName = `${firstName.trim()} ${lastName.trim()}`
      const contractor = await createSubcontractor(supabase, {
        projectId,
        name: companyName.trim(),
        contactName: managerName,
        notes: `مدیرعامل: ${managerName}`,
        createdBy: user?.id,
      })
      const contract = await createSubcontractorContract(supabase, {
        projectId,
        subcontractorId: contractor.id,
        contractNo: contractNo.trim(),
        title: `قرارداد ${companyName.trim()}`,
        startDate: contractDate,
        status: 'active',
        createdBy: user?.id,
      })
      await uploadContractFile(supabase, {
        projectId,
        contractId: contract.id,
        file: contractFile,
      })

      setFirstName('')
      setLastName('')
      setCompanyName('')
      setContractNo('')
      setContractDate('')
      setContractFile(null)
      setSuccess('پیمانکار و فایل قرارداد با موفقیت ثبت شد.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ثبت پیمانکار ناموفق بود')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadContract(
    contract: NonNullable<ProjectSubcontractor['contracts']>[number]
  ) {
    if (!contract.storage_path) return
    setDownloadingContractId(contract.id)
    setError(null)
    try {
      const { data, error: downloadError } = await supabase.storage
        .from(contract.storage_bucket || 'subcontractor-contracts')
        .download(contract.storage_path)
      if (downloadError) throw downloadError
      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = contract.file_name || `contract-${contract.id}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'دانلود قرارداد ناموفق بود'
      )
    } finally {
      setDownloadingContractId(null)
    }
  }

  function beginEdit(row: ProjectSubcontractor) {
    const managerParts = (row.contact_name ?? '').trim().split(/\s+/).filter(Boolean)
    setEditFirstName(managerParts.shift() ?? '')
    setEditLastName(managerParts.join(' '))
    setEditCompanyName(row.name)
    setEditContractNo(row.contracts?.[0]?.contract_no ?? '')
    setEditContractDate(row.contracts?.[0]?.start_date ?? '')
    setEditContractFile(null)
    setEditingId(row.id)
    setError(null)
    setSuccess(null)
  }

  async function saveEdit(row: ProjectSubcontractor) {
    const contract = row.contracts?.[0]
    if (
      !editFirstName.trim() ||
      !editLastName.trim() ||
      !editCompanyName.trim() ||
      !editContractNo.trim() ||
      !editContractDate ||
      !contract
    ) {
      setError('اطلاعات مدیرعامل، شرکت، شماره و تاریخ قرارداد را کامل کنید.')
      return
    }
    if (
      editContractFile &&
      editContractFile.type !== 'application/pdf' &&
      !editContractFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('فایل جایگزین قرارداد باید PDF باشد.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const managerName = `${editFirstName.trim()} ${editLastName.trim()}`
      await Promise.all([
        updateSubcontractorIdentity(supabase, {
          projectId,
          subcontractorId: row.id,
          name: editCompanyName,
          contactName: managerName,
        }),
        updateSubcontractorContractIdentity(supabase, {
          projectId,
          contractId: contract.id,
          contractNo: editContractNo,
          startDate: editContractDate,
          title: `قرارداد ${editCompanyName.trim()}`,
        }),
      ])
      if (editContractFile) {
        await uploadContractFile(supabase, {
          projectId,
          contractId: contract.id,
          file: editContractFile,
        })
      }
      setEditingId(null)
      setEditContractFile(null)
      setSuccess('اطلاعات پیمانکار ویرایش شد.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ویرایش پیمانکار ناموفق بود')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <Card className="border-orange-200 shadow-sm">
        <CardHeader className="border-b bg-orange-50/60">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-orange-600" />
            ثبت پیمانکار جدید
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-5">
          <form
            className="grid min-w-[1120px] grid-cols-7 items-end gap-3"
            onSubmit={handleSubmit}
          >
              <div className="space-y-1.5">
                <Label htmlFor="contractor-ceo-first-name">نام مدیرعامل</Label>
                <Input
                  id="contractor-ceo-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="نام"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractor-ceo-last-name">نام خانوادگی مدیرعامل</Label>
                <Input
                  id="contractor-ceo-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="نام خانوادگی"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractor-company-name">نام شرکت</Label>
                <Input
                  id="contractor-company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="نام شرکت پیمانکار"
                  disabled={saving}
                />
              </div>
              <ScheduleDateInput
                id="contractor-contract-date"
                label="تاریخ قرارداد"
                valueIso={contractDate}
                onChangeIso={setContractDate}
                className="[&>p]:hidden"
                disabled={saving}
                required
              />
              <div className="space-y-1.5">
                <Label htmlFor="contractor-contract-no">شماره قرارداد</Label>
                <Input
                  id="contractor-contract-no"
                  value={contractNo}
                  onChange={(event) => setContractNo(event.target.value)}
                  placeholder="شماره قرارداد"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractor-contract-file">آپلود قرارداد</Label>
                <Input
                  id="contractor-contract-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={saving}
                  onChange={(event) => setContractFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="me-2 h-4 w-4" />
                )}
                ثبت پیمانکار
              </Button>

            {error ? <p className="col-span-7 text-sm text-red-700">{error}</p> : null}
            {success ? (
              <p className="col-span-7 text-sm text-emerald-700">{success}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">پیمانکاران ثبت‌شده</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال بارگذاری...
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز پیمانکاری ثبت نشده است.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => {
                const contract = row.contracts?.[0]
                return (
                  <div key={row.id} className="rounded-lg border bg-white p-4">
                    {editingId === row.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={editFirstName}
                            onChange={(event) => setEditFirstName(event.target.value)}
                            placeholder="نام مدیرعامل"
                            disabled={saving}
                          />
                          <Input
                            value={editLastName}
                            onChange={(event) => setEditLastName(event.target.value)}
                            placeholder="نام خانوادگی مدیرعامل"
                            disabled={saving}
                          />
                          <Input
                            value={editCompanyName}
                            onChange={(event) => setEditCompanyName(event.target.value)}
                            placeholder="نام شرکت"
                            disabled={saving}
                          />
                          <Input
                            value={editContractNo}
                            onChange={(event) => setEditContractNo(event.target.value)}
                            placeholder="شماره قرارداد"
                            disabled={saving}
                          />
                          <ScheduleDateInput
                            label="تاریخ قرارداد"
                            valueIso={editContractDate}
                            onChangeIso={setEditContractDate}
                            className="[&>p]:hidden"
                            disabled={saving}
                          />
                          <div className="space-y-1.5">
                            <Label className="text-xs">تعویض فایل PDF (اختیاری)</Label>
                            <Input
                              type="file"
                              accept=".pdf,application/pdf"
                              disabled={saving}
                              onChange={(event) =>
                                setEditContractFile(event.target.files?.[0] ?? null)
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={saving}
                            onClick={() => void saveEdit(row)}
                          >
                            {saving ? (
                              <Loader2 className="me-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="me-2 h-4 w-4" />
                            )}
                            ذخیره ویرایش
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setEditingId(null)}
                          >
                            <X className="me-2 h-4 w-4" />
                            انصراف
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-2 font-semibold">
                            <Building2 className="h-4 w-4 text-orange-600" />
                            {row.name}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => beginEdit(row)}
                          >
                            <Pencil className="me-1 h-3.5 w-3.5" />
                            ویرایش
                          </Button>
                        </div>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                          <UserRound className="h-4 w-4" />
                          مدیرعامل: {row.contact_name || '—'}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                          <FileText className="h-4 w-4" />
                          شماره قرارداد: {contract?.contract_no || '—'} · تاریخ:{' '}
                          {contract?.start_date || '—'}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {contract?.storage_path ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={downloadingContractId === contract.id}
                              onClick={() => void handleDownloadContract(contract)}
                            >
                              {downloadingContractId === contract.id ? (
                                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="me-2 h-4 w-4" />
                              )}
                              دانلود قرارداد PDF
                            </Button>
                          ) : (
                          <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                            <Upload className="h-4 w-4" />
                            فایل قرارداد ثبت نشده
                          </p>
                          )}
                          <Button
                            type="button"
                            variant={
                              activitiesContractorId === row.id ? 'default' : 'outline'
                            }
                            size="sm"
                            onClick={() =>
                              setActivitiesContractorId((current) =>
                                current === row.id ? null : row.id
                              )
                            }
                          >
                            <ClipboardList className="me-1 h-4 w-4" />
                            فعالیت‌ها
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {activitiesContractorId ? (
            <ContractorActivitiesPanel
              projectId={projectId}
              contractorId={activitiesContractorId}
              contractorName={
                rows.find((row) => row.id === activitiesContractorId)?.name ?? 'پیمانکار'
              }
              onClose={() => setActivitiesContractorId(null)}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
