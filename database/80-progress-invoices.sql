-- =====================================================
-- Progress invoices (صورت‌وضعیت اجرایی) — MVP
-- Run in Supabase SQL Editor after migration 79
-- =====================================================

CREATE TABLE IF NOT EXISTS public.progress_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  period_start DATE,
  period_end DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'final', 'sent_to_finance')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_progress_invoices_project
  ON public.progress_invoices(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.progress_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.progress_invoices(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  uom TEXT NOT NULL DEFAULT 'm',
  estimated_qty NUMERIC(18, 3) NOT NULL CHECK (estimated_qty > 0),
  unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  final_qty NUMERIC(18, 3) CHECK (final_qty IS NULL OR final_qty > 0),
  final_qty_set_at TIMESTAMPTZ,
  final_qty_set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  final_qty_reason TEXT,
  progress_percent NUMERIC(6, 2) NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'in_review',
      'needs_tech_approval',
      'final_qty_set',
      'completed',
      'needs_correction'
    )),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_invoice_items_invoice
  ON public.progress_invoice_items(invoice_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.progress_invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.progress_invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.progress_invoice_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'invoice_created',
    'invoice_updated',
    'item_added',
    'item_updated',
    'progress_set',
    'final_qty_set',
    'status_change',
    'sent_to_finance',
    'tech_review_requested'
  )),
  old_progress NUMERIC(6, 2),
  new_progress NUMERIC(6, 2),
  old_qty NUMERIC(18, 3),
  new_qty NUMERIC(18, 3),
  qty_kind TEXT CHECK (qty_kind IS NULL OR qty_kind IN ('estimated', 'final')),
  reason TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_invoice_events_invoice
  ON public.progress_invoice_events(invoice_id, created_at DESC);

DROP TRIGGER IF EXISTS progress_invoices_set_updated_at ON public.progress_invoices;
CREATE TRIGGER progress_invoices_set_updated_at
  BEFORE UPDATE ON public.progress_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS progress_invoice_items_set_updated_at ON public.progress_invoice_items;
CREATE TRIGGER progress_invoice_items_set_updated_at
  BEFORE UPDATE ON public.progress_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.progress_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_invoice_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progress_invoices_all ON public.progress_invoices;
CREATE POLICY progress_invoices_all ON public.progress_invoices
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS progress_invoice_items_all ON public.progress_invoice_items;
CREATE POLICY progress_invoice_items_all ON public.progress_invoice_items
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));

DROP POLICY IF EXISTS progress_invoice_events_all ON public.progress_invoice_events;
CREATE POLICY progress_invoice_events_all ON public.progress_invoice_events
  FOR ALL TO authenticated
  USING (public.is_system_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_system_admin() OR public.is_project_member(project_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.progress_invoice_events TO authenticated;

NOTIFY pgrst, 'reload schema';
