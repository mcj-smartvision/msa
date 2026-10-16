/**
 * @file features/finance/services/vendor-bills.ts
 * @purpose سرویس داده — حسابداری، هزینه،overhead و صورت‌وضعیت (vendor-bills)
 * @safe-to-edit CAREFUL
 * @affects حسابداری، هزینه،overhead و صورت‌وضعیت
 * @depends-on features/finance/services/payables
 */

/**
 * Compatibility re-exports — prefer `@/features/finance/services/payables`.
 * vendor_bills is the storage table for contractor payables.
 */
export {
  fetchVendorBills,
  fetchContractorPayables,
  buildVendorBillKpis,
  getUnpaidVendorBills,
  buildPayableSummary,
  createContractorPayable,
  recordPayablePayment,
  cancelContractorPayable,
  ensurePayableForFinalizedExpense,
} from '@/features/finance/services/payables'
