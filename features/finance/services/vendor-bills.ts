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
