-- =====================================================
-- Member account change requests (username / profile)
-- Run after migration 55
-- =====================================================

CREATE TABLE IF NOT EXISTS public.account_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  current_value TEXT,
  requested_value TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_change_requests_user
  ON public.account_change_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_change_requests_status
  ON public.account_change_requests (status, created_at DESC);

ALTER TABLE public.account_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_change_requests_select ON public.account_change_requests;
CREATE POLICY account_change_requests_select ON public.account_change_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS account_change_requests_insert ON public.account_change_requests;
CREATE POLICY account_change_requests_insert ON public.account_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS account_change_requests_admin_update ON public.account_change_requests;
CREATE POLICY account_change_requests_admin_update ON public.account_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());
