'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Package,
  PenLine,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Warehouse,
} from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { FormattedDate } from '@/components/schedule/formatted-date'
import { ScheduleDateInput } from '@/components/schedule/schedule-date-input'
import { PageHeader, LoadingBlock, ErrorBlock, SectionCard } from '@/components/admin/shared'
import { StatCard } from '@/components/admin/stat-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  UiBlockCustomizePanel,
  UiBlockGuard,
  UiBlockVisibilityProvider,
} from '@/components/dashboard/ui-block-visibility'
import { getStorekeeperMessages } from '@/lib/i18n/storekeeper'
import { writeProjectCookie } from '@/lib/project/project-cookie'
import type { ExtractedInvoiceLine } from '@/lib/storekeeper/types'
import type { DashboardUserContext } from '@/types/dashboard'
import { useSupabase } from '@/hooks/useSupabase'
import {
  analyzeInvoiceImage,
  confirmInventoryReceipt,
  confirmInventoryDispatch,
  createInventoryScan,
  fetchInventoryItems,
  fetchInventoryKpis,
  fetchInventoryTransactions,
  updateScanExtractedData,
  uploadInvoiceImage,
} from '@/utils/storekeeper/inventory'
import type { InventoryItemRow, InventoryKpis, InventoryTransactionRow } from '@/lib/storekeeper/types'

interface StorekeeperDashboardProps {
  initialContext: DashboardUserContext
  projectOptions?: { id: string; name: string }[]
  initialProjectId?: string | null
  visibleBlockCodes?: string[]
}

function newExtractedRow(): ExtractedInvoiceLine {
  return {
    id: crypto.randomUUID(),
    name: '',
    quantity: 1,
    unit: 'عدد',
  }
}

function todayDateInputValue() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function StorekeeperDashboard({
  initialContext,
  projectOptions: projectOptionsProp,
  initialProjectId,
  visibleBlockCodes = [],
}: StorekeeperDashboardProps) {
  const supabase = useSupabase()
  const { locale, dir } = useLocale()
  const t = getStorekeeperMessages(locale)
  const isRtl = dir === 'rtl'

  const [context] = useState(initialContext)
  const [projectId, setProjectId] = useState<string | null>(
    initialProjectId ?? initialContext.activeProjectId
  )
  const [items, setItems] = useState<InventoryItemRow[]>([])
  const [transactions, setTransactions] = useState<InventoryTransactionRow[]>([])
  const [kpis, setKpis] = useState<InventoryKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [extractedRows, setExtractedRows] = useState<ExtractedInvoiceLine[]>([])
  const [entryMode, setEntryMode] = useState<'none' | 'ai' | 'manual'>('none')
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN')
  const [invoiceDate, setInvoiceDate] = useState(todayDateInputValue)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [scannerError, setScannerError] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    if (!projectId) {
      setItems([])
      setTransactions([])
      setKpis(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [nextItems, nextTx, nextKpis] = await Promise.all([
        fetchInventoryItems(supabase, projectId),
        fetchInventoryTransactions(supabase, projectId),
        fetchInventoryKpis(supabase, projectId),
      ])
      setItems(nextItems)
      setTransactions(nextTx)
      setKpis(nextKpis)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadError)
    } finally {
      setLoading(false)
    }
  }, [projectId, supabase, t.loadError])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return () => {
      if (scanPreview) URL.revokeObjectURL(scanPreview)
    }
  }, [scanPreview])

  function handleProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId)
    writeProjectCookie(nextProjectId)
    resetScanner()
  }

  function resetScanner() {
    setScanFile(null)
    if (scanPreview) URL.revokeObjectURL(scanPreview)
    setScanPreview(null)
    setScanId(null)
    setExtractedRows([])
    setEntryMode('none')
    setInvoiceDate(todayDateInputValue())
    setInvoiceNumber('')
    setScannerError(null)
    setSuccessMessage(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  function startManualEntry() {
    setScannerError(null)
    setSuccessMessage(null)
    setScanFile(null)
    if (scanPreview) URL.revokeObjectURL(scanPreview)
    setScanPreview(null)
    setScanId(null)
    setEntryMode('manual')
    setExtractedRows([newExtractedRow()])
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }

  function handleFileSelected(file: File | null) {
    if (!file) return
    setScannerError(null)
    setSuccessMessage(null)
    setEntryMode('ai')
    setScanFile(file)
    if (scanPreview) URL.revokeObjectURL(scanPreview)
    setScanPreview(URL.createObjectURL(file))
    setExtractedRows([])
    setScanId(null)
  }

  async function handleAnalyze() {
    if (!projectId || !scanFile) return

    setAnalyzing(true)
    setScannerError(null)
    setSuccessMessage(null)

    try {
      const imageUrl = await uploadInvoiceImage(supabase, projectId, scanFile)
      const newScanId = await createInventoryScan(supabase, projectId, imageUrl)
      setScanId(newScanId)

      const extracted = await analyzeInvoiceImage(supabase, scanFile)
      if (extracted.length === 0) {
        setExtractedRows([newExtractedRow()])
        setScannerError(t.analyzeError)
        return
      }

      setExtractedRows(
        extracted.map((row) => ({
          id: crypto.randomUUID(),
          name: row.name,
          quantity: Number(row.quantity),
          unit: row.unit || 'عدد',
        }))
      )

      await updateScanExtractedData(supabase, newScanId, extracted)
    } catch (err) {
      setScannerError(err instanceof Error ? err.message : t.analyzeError)
      if (extractedRows.length === 0) setExtractedRows([newExtractedRow()])
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleConfirmSave() {
    if (!projectId) return

    if (!invoiceDate.trim()) {
      setScannerError(t.invoiceDateRequired)
      return
    }

    const payload = extractedRows
      .map((row) => ({
        name: row.name.trim(),
        quantity: Number(row.quantity),
        unit: row.unit.trim() || 'عدد',
      }))
      .filter((row) => row.name && row.quantity > 0)

    if (payload.length === 0) {
      setScannerError(t.noExtracted)
      return
    }

    setSaving(true)
    setScannerError(null)

    const note =
      entryMode === 'manual'
        ? transactionType === 'IN'
          ? 'ثبت دستی فاکتور'
          : 'ثبت دستی خروج'
        : transactionType === 'IN'
          ? 'رسید فاکتور با هوش مصنوعی'
          : 'سند خروج با هوش مصنوعی'

    try {
      const save = transactionType === 'IN' ? confirmInventoryReceipt : confirmInventoryDispatch
      await save(
        supabase,
        projectId,
        payload,
        invoiceDate,
        scanId,
        note,
        invoiceNumber.trim() || null
      )
      setSuccessMessage(transactionType === 'IN' ? t.successSaved : t.successDispatched)
      resetScanner()
      await loadData()
    } catch (err) {
      setScannerError(err instanceof Error ? err.message : t.saveError)
    } finally {
      setSaving(false)
    }
  }

  function updateExtractedRow(id: string, patch: Partial<ExtractedInvoiceLine>) {
    setExtractedRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeExtractedRow(id: string) {
    setExtractedRows((rows) => rows.filter((row) => row.id !== id))
  }

  const projectOptions = useMemo(
    () =>
      projectOptionsProp && projectOptionsProp.length > 0
        ? projectOptionsProp
        : context.projects.map((p) => ({ id: p.project.id, name: p.project.name })),
    [projectOptionsProp, context.projects]
  )

  if (!projectId) {
    return (
      <div className={cn('space-y-6', isRtl && 'text-right')}>
        <PageHeader title={t.title} description={t.description} />
        <ErrorBlock message={t.noProject} />
      </div>
    )
  }

  if (loading && !kpis) {
    return <LoadingBlock label={t.title} />
  }

  const stockList = (
    <>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t.emptyStock}</p>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {items.map((item) => {
              const isLow = Number(item.current_stock) < Number(item.min_stock)
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3.5"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium leading-snug break-words">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.current_stock} {item.unit}
                      <span className="mx-1.5 opacity-40">·</span>
                      {t.minStock}: {item.min_stock}
                    </p>
                  </div>
                  <Badge variant={isLow ? 'destructive' : 'secondary'} className="shrink-0">
                    {isLow ? t.low : t.ok}
                  </Badge>
                </div>
              )
            })}
          </div>
          <div className="hidden md:block overflow-x-auto -mx-2">
            <table className={cn('w-full text-sm', isRtl && 'text-right')}>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-2 font-medium">{t.name}</th>
                  <th className="py-2 px-2 font-medium">{t.currentStock}</th>
                  <th className="py-2 px-2 font-medium">{t.unit}</th>
                  <th className="py-2 px-2 font-medium">{t.minStock}</th>
                  <th className="py-2 px-2 font-medium">{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLow = Number(item.current_stock) < Number(item.min_stock)
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2.5 px-2 font-medium">{item.name}</td>
                      <td className="py-2.5 px-2">{item.current_stock}</td>
                      <td className="py-2.5 px-2">{item.unit}</td>
                      <td className="py-2.5 px-2">{item.min_stock}</td>
                      <td className="py-2.5 px-2">
                        <Badge variant={isLow ? 'destructive' : 'secondary'}>{isLow ? t.low : t.ok}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )

  const transactionsList = (
    <>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t.emptyTransactions}</p>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium leading-snug break-words">
                    {tx.inventory_items?.name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.quantity} {tx.unit}
                    <span className="mx-1.5 opacity-40">·</span>
                    <FormattedDate value={tx.date} dateTime />
                  </p>
                </div>
                <Badge variant={tx.type === 'IN' ? 'default' : 'outline'} className="shrink-0">
                  {tx.type}
                </Badge>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto -mx-2">
            <table className={cn('w-full text-sm', isRtl && 'text-right')}>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-2 font-medium">{t.name}</th>
                  <th className="py-2 px-2 font-medium">{t.type}</th>
                  <th className="py-2 px-2 font-medium">{t.quantity}</th>
                  <th className="py-2 px-2 font-medium">{t.unit}</th>
                  <th className="py-2 px-2 font-medium">{t.date}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-2.5 px-2">{tx.inventory_items?.name ?? '—'}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant={tx.type === 'IN' ? 'default' : 'outline'}>{tx.type}</Badge>
                    </td>
                    <td className="py-2.5 px-2">{tx.quantity}</td>
                    <td className="py-2.5 px-2">{tx.unit}</td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <FormattedDate value={tx.date} dateTime />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )

  return (
    <UiBlockVisibilityProvider
      visibleCodes={visibleBlockCodes}
      showAdminBlockCodes={context.isSystemAdmin}
      dashboard="storekeeper"
      projectId={projectId}
    >
    <div className={cn('space-y-5 md:space-y-8', isRtl && 'text-right')} dir={dir}>
      <UiBlockCustomizePanel />

      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          projectOptions.length > 1 ? (
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-full min-h-11 sm:w-[220px]">
                <SelectValue placeholder={t.selectProject} />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      {error ? <ErrorBlock message={error} onRetry={loadData} /> : null}

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-5 md:gap-6">
        {kpis ? (
          <UiBlockGuard code="SK-KPI-01">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard label={t.totalItems} value={kpis.totalItems} icon={Package} />
            <StatCard
              label={t.lowStock}
              value={kpis.lowStockItems}
              icon={AlertCircle}
              trendType={kpis.lowStockItems > 0 ? 'warning' : 'neutral'}
            />
            <StatCard label={t.incomingToday} value={kpis.incomingToday} icon={TrendingUp} trendType="up" />
            <StatCard label={t.outgoingToday} value={kpis.outgoingToday} icon={TrendingDown} trendType="down" />
          </div>
          </UiBlockGuard>
        ) : null}

        {/* On phone: entry/scan first — primary warehouse workflow */}
        <div className="order-2 md:order-3">
          <UiBlockGuard code="SK-ACT-01">
          <Card className="border-primary/20 shadow-card">
            <CardHeader className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg sm:text-xl">
                      {transactionType === 'IN' ? t.receiveStock : t.dispatchStock}
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      {transactionType === 'IN' ? t.receiveHint : t.dispatchHint}
                    </CardDescription>
                  </div>
                </div>
                <div className="grid w-full grid-cols-2 gap-1 rounded-lg border p-1 bg-muted/30 sm:flex sm:w-auto">
                  <Button
                    type="button"
                    className="min-h-11 sm:min-h-9"
                    size="sm"
                    variant={transactionType === 'IN' ? 'default' : 'ghost'}
                    onClick={() => {
                      setTransactionType('IN')
                      resetScanner()
                    }}
                  >
                    {t.stockIn}
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11 sm:min-h-9"
                    size="sm"
                    variant={transactionType === 'OUT' ? 'default' : 'ghost'}
                    onClick={() => {
                      setTransactionType('OUT')
                      resetScanner()
                    }}
                  >
                    {t.stockOut}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid gap-4 sm:grid-cols-2 rounded-xl border bg-muted/20 p-3 sm:p-4">
                <div className="space-y-2">
                  <ScheduleDateInput
                    id="invoice-date"
                    label={`${t.invoiceDate} *`}
                    valueIso={invoiceDate}
                    onChangeIso={setInvoiceDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-number">
                    {t.invoiceNumber}{' '}
                    <span className="text-muted-foreground font-normal">({t.invoiceNumberOptional})</span>
                  </Label>
                  <Input
                    id="invoice-number"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder={t.invoiceNumberOptional}
                    className="min-h-11 h-11 sm:h-10 sm:min-h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant={entryMode === 'ai' && scanFile ? 'default' : 'outline'}
                  className="min-h-12 w-full"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className={cn('h-4 w-4', isRtl ? 'ml-2' : 'mr-2')} />
                  {t.takePhoto}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 w-full"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className={cn('h-4 w-4', isRtl ? 'ml-2' : 'mr-2')} />
                  {t.uploadInvoice}
                </Button>
                <Button
                  type="button"
                  variant={entryMode === 'manual' ? 'default' : 'outline'}
                  className="min-h-12 w-full"
                  onClick={startManualEntry}
                >
                  <PenLine className={cn('h-4 w-4', isRtl ? 'ml-2' : 'mr-2')} />
                  {t.manualEntry}
                </Button>
              </div>

              {entryMode === 'ai' && scanFile ? (
                <Button
                  type="button"
                  className="min-h-12 w-full"
                  disabled={analyzing}
                  onClick={handleAnalyze}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className={cn('h-4 w-4 animate-spin', isRtl ? 'ml-2' : 'mr-2')} />
                      {t.analyzing}
                    </>
                  ) : (
                    t.analyzeWithAi
                  )}
                </Button>
              ) : null}

              {entryMode === 'manual' ? (
                <p className="text-sm text-muted-foreground">{t.manualHint}</p>
              ) : null}

              {scanPreview ? (
                <div className="rounded-xl border overflow-hidden bg-muted/30 w-full max-w-md mx-auto sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scanPreview} alt="پیش‌نمایش فاکتور" className="w-full max-h-64 object-contain" />
                </div>
              ) : null}

              {scannerError ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {scannerError}
                </div>
              ) : null}

              {extractedRows.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">{t.itemsToReceive}</h4>

                  <div className="md:hidden space-y-3">
                    {extractedRows.map((row, index) => (
                      <div key={row.id} className="rounded-xl border bg-background p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            aria-label={t.deleteRow}
                            onClick={() => removeExtractedRow(row.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t.name}</Label>
                          <Input
                            value={row.name}
                            onChange={(e) => updateExtractedRow(row.id, { name: e.target.value })}
                            className="min-h-11 h-11"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t.quantity}</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={row.quantity}
                              onChange={(e) =>
                                updateExtractedRow(row.id, { quantity: Number(e.target.value) || 0 })
                              }
                              className="min-h-11 h-11"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">{t.unit}</Label>
                            <Input
                              value={row.unit}
                              onChange={(e) => updateExtractedRow(row.id, { unit: e.target.value })}
                              className="min-h-11 h-11"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto rounded-xl border">
                    <table className={cn('w-full text-sm', isRtl && 'text-right')}>
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="py-2 px-2 font-medium">{t.name}</th>
                          <th className="py-2 px-2 font-medium w-28">{t.quantity}</th>
                          <th className="py-2 px-2 font-medium w-32">{t.unit}</th>
                          <th className="py-2 px-2 w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {extractedRows.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="p-2">
                              <Input
                                value={row.name}
                                onChange={(e) => updateExtractedRow(row.id, { name: e.target.value })}
                                className="h-9"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={row.quantity}
                                onChange={(e) =>
                                  updateExtractedRow(row.id, { quantity: Number(e.target.value) || 0 })
                                }
                                className="h-9"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.unit}
                                onChange={(e) => updateExtractedRow(row.id, { unit: e.target.value })}
                                className="h-9"
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t.deleteRow}
                                onClick={() => removeExtractedRow(row.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-card/95 backdrop-blur border-t sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 w-full sm:w-auto"
                      onClick={() => setExtractedRows((r) => [...r, newExtractedRow()])}
                    >
                      <Plus className={cn('h-4 w-4', isRtl ? 'ml-2' : 'mr-2')} />
                      {t.addRow}
                    </Button>
                    <Button
                      type="button"
                      className="min-h-12 w-full sm:ml-auto sm:w-auto"
                      disabled={saving}
                      onClick={handleConfirmSave}
                    >
                      {saving ? (
                        <>
                          <Loader2 className={cn('h-4 w-4 animate-spin', isRtl ? 'ml-2' : 'mr-2')} />
                          {t.saving}
                        </>
                      ) : (
                        transactionType === 'IN' ? t.confirmSave : t.confirmDispatch
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
          </UiBlockGuard>
        </div>

        <div className="order-3 md:order-2 grid gap-5 md:gap-6 xl:grid-cols-2">
          <UiBlockGuard code="SK-TBL-01">
            <SectionCard title={t.stockTable} description={t.emptyStock}>
              {stockList}
            </SectionCard>
          </UiBlockGuard>

          <UiBlockGuard code="SK-TBL-02">
            <SectionCard title={t.transactionsTable} description={t.emptyTransactions}>
              {transactionsList}
            </SectionCard>
          </UiBlockGuard>
        </div>
      </div>
    </div>
    </UiBlockVisibilityProvider>
  )
}
