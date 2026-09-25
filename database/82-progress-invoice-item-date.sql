-- =====================================================
-- Progress invoice items: per-item work date
-- Run once in Supabase → SQL Editor
-- =====================================================

ALTER TABLE public.progress_invoice_items
  ADD COLUMN IF NOT EXISTS item_date DATE;

NOTIFY pgrst, 'reload schema';
