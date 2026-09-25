-- =====================================================
-- Progress invoices: unit price + editable event types
-- Run this ONCE in Supabase → SQL Editor, then click Run
-- =====================================================

ALTER TABLE public.progress_invoice_items
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'progress_invoice_events'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.progress_invoice_events DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.progress_invoice_events
  ADD CONSTRAINT progress_invoice_events_event_type_check
  CHECK (event_type IN (
    'invoice_created',
    'invoice_updated',
    'item_added',
    'item_updated',
    'progress_set',
    'final_qty_set',
    'status_change',
    'sent_to_finance',
    'tech_review_requested'
  ));

NOTIFY pgrst, 'reload schema';
