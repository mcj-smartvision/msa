'use client'

import { FormattedDate } from '@/features/schedule/components/formatted-date'
import type { AccountingDocument, ExpenseItem } from '@/features/finance/lib/expense-types'
import { formatInvoiceNumber, getInvoiceWeekday } from '@/features/finance/lib/invoice-weekday'
import { rialToToman, tomanAmountToPersianWords } from '@/features/finance/lib/persian-amount-words'
import { cn } from '@/shared/lib/utils'

export interface SalesInvoiceViewProps {
  doc: AccountingDocument
  projectName?: string | null
  locale?: 'fa' | 'en'
  className?: string
  /** Compact mode for modal; full for print-like preview */
  compact?: boolean
}

function lineQty(item: ExpenseItem): number {
  return Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1
}

function lineUnitPriceToman(item: ExpenseItem): number {
  return rialToToman(item.unit_price)
}

function lineAmountToman(item: ExpenseItem): number {
  return rialToToman(item.amount)
}

export function SalesInvoiceView({
  doc,
  projectName,
  locale = 'fa',
  className,
  compact = false,
}: SalesInvoiceViewProps) {
  const isFa = locale === 'fa'
  const items = [...(doc.expense_items ?? [])].sort((a, b) => a.line_no - b.line_no)
  const totalToman = rialToToman(doc.amount)
  const weekday = getInvoiceWeekday(doc.document_date, isFa ? 'fa' : 'en')
  const amountWords = isFa
    ? tomanAmountToPersianWords(totalToman)
    : `${formatInvoiceNumber(totalToman, 'en')} Tomans`

  const labels = isFa
    ? {
        title: 'فاکتور فروش',
        invoiceNo: 'شماره فاکتور',
        date: 'تاریخ',
        day: 'روز',
        buyer: 'خریدار',
        project: 'پروژه',
        phone: 'شماره تماس',
        row: 'ردیف',
        desc: 'شرح کالا',
        unit: 'واحد',
        qty: 'تعداد',
        unitPrice: 'فی (تومان)',
        multiply: 'ضرب',
        lineTotal: 'مبلغ کل (تومان)',
        grandTotal: 'جمع کل',
        amountWords: 'مبلغ به حروف',
        sellerSign: 'امضاء فروشنده',
        sellerStamp: 'مهر و امضاء فروشنده',
        buyerSign: 'امضاء خریدار',
        disclaimer:
          'کالاهای فوق سالم تحویل گردید و خریدار از نظر تعداد و قیمت تأیید می‌نماید.',
        noLines: 'ردیفی ثبت نشده است.',
        supplierAsSeller: 'فروشنده',
      }
    : {
        title: 'Sales Invoice',
        invoiceNo: 'Invoice No.',
        date: 'Date',
        day: 'Day',
        buyer: 'Buyer',
        project: 'Project',
        phone: 'Phone',
        row: '#',
        desc: 'Description',
        unit: 'Unit',
        qty: 'Qty',
        unitPrice: 'Unit price (Toman)',
        multiply: 'Calc',
        lineTotal: 'Line total (Toman)',
        grandTotal: 'Grand total',
        amountWords: 'Amount in words',
        sellerSign: 'Seller signature',
        sellerStamp: 'Seller stamp & signature',
        buyerSign: 'Buyer signature',
        disclaimer:
          'Goods delivered in good condition; buyer has verified quantities and prices.',
        noLines: 'No line items.',
        supplierAsSeller: 'Seller',
      }

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className={cn(
        'rounded-md border border-neutral-800 bg-white text-neutral-900',
        compact ? 'p-3 text-xs sm:text-sm' : 'p-5 text-sm',
        className
      )}
    >
      <h2 className="text-center text-lg font-bold tracking-wide sm:text-xl">{labels.title}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold">{labels.invoiceNo}:</span>
            <span className="border-b border-dotted border-neutral-400 flex-1 min-w-0">
              {doc.invoice_no || doc.document_no || '—'}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold">{labels.date}:</span>
            <span className="border-b border-dotted border-neutral-400 flex-1">
              <FormattedDate value={doc.document_date} />
            </span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold">{labels.day}:</span>
            <span className="border-b border-dotted border-neutral-400 flex-1">{weekday}</span>
          </div>
          {doc.supplier_name ? (
            <div className="flex gap-2 text-muted-foreground">
              <span className="shrink-0 font-semibold text-foreground">
                {labels.supplierAsSeller}:
              </span>
              <span>{doc.supplier_name}</span>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold">{labels.buyer}:</span>
            <span className="border-b border-dotted border-neutral-400 flex-1 min-h-[1.25rem]" />
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold">{labels.project}:</span>
            <span className="border-b border-dotted border-neutral-400 flex-1">
              {projectName || '—'}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0 font-semibold">{labels.phone}:</span>
            <span className="border-b border-dotted border-neutral-400 flex-1 min-h-[1.25rem]" />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse border border-neutral-800 text-center">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold whitespace-nowrap">
                {labels.row}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold min-w-[8rem]">
                {labels.desc}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold whitespace-nowrap">
                {labels.unit}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold whitespace-nowrap">
                {labels.qty}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold whitespace-nowrap">
                {labels.unitPrice}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold whitespace-nowrap">
                {labels.multiply}
              </th>
              <th className="border border-neutral-800 px-1.5 py-1.5 font-semibold whitespace-nowrap">
                {labels.lineTotal}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-neutral-800 px-2 py-4 text-muted-foreground">
                  {labels.noLines}
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const qty = lineQty(item)
                const unitToman = lineUnitPriceToman(item)
                const total = lineAmountToman(item)
                const calc = `${formatInvoiceNumber(qty, isFa ? 'fa' : 'en')} × ${formatInvoiceNumber(unitToman, isFa ? 'fa' : 'en')}`
                return (
                  <tr key={item.id || `line-${idx}`}>
                    <td className="border border-neutral-800 px-1.5 py-1.5 tabular-nums">
                      {item.line_no || idx + 1}
                    </td>
                    <td className="border border-neutral-800 px-1.5 py-1.5 text-start">
                      {item.description || '—'}
                    </td>
                    <td className="border border-neutral-800 px-1.5 py-1.5 whitespace-nowrap">
                      {item.unit || '—'}
                    </td>
                    <td className="border border-neutral-800 px-1.5 py-1.5 tabular-nums">
                      {formatInvoiceNumber(qty, isFa ? 'fa' : 'en')}
                    </td>
                    <td className="border border-neutral-800 px-1.5 py-1.5 tabular-nums whitespace-nowrap">
                      {formatInvoiceNumber(unitToman, isFa ? 'fa' : 'en')}
                    </td>
                    <td className="border border-neutral-800 px-1.5 py-1.5 tabular-nums text-[0.7rem] sm:text-xs whitespace-nowrap">
                      {calc}
                    </td>
                    <td className="border border-neutral-800 px-1.5 py-1.5 tabular-nums font-medium whitespace-nowrap">
                      {formatInvoiceNumber(total, isFa ? 'fa' : 'en')}
                    </td>
                  </tr>
                )
              })
            )}
            <tr className="bg-neutral-50 font-semibold">
              <td
                colSpan={6}
                className="border border-neutral-800 px-2 py-2 text-start"
              >
                {labels.grandTotal}
              </td>
              <td className="border border-neutral-800 px-1.5 py-2 tabular-nums whitespace-nowrap">
                {formatInvoiceNumber(totalToman, isFa ? 'fa' : 'en')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border border-neutral-800 px-2 py-2">
        <span className="font-semibold shrink-0">{labels.amountWords}:</span>
        <span>{amountWords}</span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center text-[0.7rem] sm:text-xs">
        <div className="flex flex-col justify-end min-h-[4.5rem]">
          <div className="border-t border-neutral-800 pt-1">{labels.sellerSign}</div>
        </div>
        <div className="flex flex-col items-center justify-end min-h-[4.5rem]">
          <div className="mb-2 h-14 w-full max-w-[9rem] rounded border-2 border-sky-600/80" />
          <div>{labels.sellerStamp}</div>
        </div>
        <div className="flex flex-col justify-end min-h-[4.5rem]">
          <div className="border-t border-neutral-800 pt-1">{labels.buyerSign}</div>
        </div>
      </div>

      <p className="mt-4 text-[0.65rem] sm:text-xs text-muted-foreground leading-relaxed">
        {labels.disclaimer}
      </p>
    </div>
  )
}
