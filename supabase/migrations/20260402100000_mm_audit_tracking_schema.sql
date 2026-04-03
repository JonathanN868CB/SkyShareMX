-- ============================================================================
-- MM Revision & Audit Tracking — Schema
-- ============================================================================
-- Replaces the "MM Revision and Audit Tracking" Excel spreadsheet.
-- Tracks OEM source document revisions, per-aircraft audit status,
-- quarterly audit campaigns, and MEL/Policy Letter currency.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. mm_source_documents — One row per OEM manual / service bulletin
-- --------------------------------------------------------------------------
CREATE TABLE public.mm_source_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL,
  document_name   text NOT NULL,
  document_url    text,
  current_revision text NOT NULL,
  current_rev_date date,
  updated_by      uuid REFERENCES public.profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  notes           text,
  CONSTRAINT mm_source_documents_number_unique UNIQUE (document_number)
);

ALTER TABLE public.mm_source_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_source_docs_select" ON public.mm_source_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mm_source_docs_insert" ON public.mm_source_documents
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_source_docs_update" ON public.mm_source_documents
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_source_docs_delete" ON public.mm_source_documents
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- --------------------------------------------------------------------------
-- 2. mm_aircraft_documents — Per-tail link to a source doc + assembly
-- --------------------------------------------------------------------------
CREATE TABLE public.mm_aircraft_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id         uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  source_document_id  uuid NOT NULL REFERENCES public.mm_source_documents(id) ON DELETE CASCADE,
  assembly_type       text NOT NULL CHECK (assembly_type IN ('airframe', 'engine', 'prop', 'apu')),
  requirement_type    text NOT NULL CHECK (requirement_type IN ('awl', 'sched_mx')),
  section             text,
  assembly_detail     text,
  is_applicable       boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_aircraft_docs_unique UNIQUE (aircraft_id, source_document_id, assembly_type, requirement_type)
);

ALTER TABLE public.mm_aircraft_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_aircraft_docs_select" ON public.mm_aircraft_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mm_aircraft_docs_insert" ON public.mm_aircraft_documents
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_aircraft_docs_update" ON public.mm_aircraft_documents
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_aircraft_docs_delete" ON public.mm_aircraft_documents
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- --------------------------------------------------------------------------
-- 3. mm_audit_campaigns — Quarterly audit cycle container
-- --------------------------------------------------------------------------
CREATE TABLE public.mm_audit_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by  uuid REFERENCES public.profiles(id),
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_campaigns_period_check CHECK (period_end > period_start)
);

ALTER TABLE public.mm_audit_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_campaigns_select" ON public.mm_audit_campaigns
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mm_campaigns_insert" ON public.mm_audit_campaigns
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_campaigns_update" ON public.mm_audit_campaigns
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_campaigns_delete" ON public.mm_audit_campaigns
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- --------------------------------------------------------------------------
-- 4. mm_campaign_assignments — Auditor assignment per campaign
-- --------------------------------------------------------------------------
CREATE TABLE public.mm_campaign_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES public.mm_audit_campaigns(id) ON DELETE CASCADE,
  assigned_to   uuid NOT NULL REFERENCES public.profiles(id),
  model_family  text,
  aircraft_id   uuid REFERENCES public.aircraft(id) ON DELETE CASCADE,
  assigned_by   uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mm_campaign_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_assignments_select" ON public.mm_campaign_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mm_assignments_insert" ON public.mm_campaign_assignments
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_assignments_update" ON public.mm_campaign_assignments
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_assignments_delete" ON public.mm_campaign_assignments
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- --------------------------------------------------------------------------
-- 5. mm_audit_records — Every audit performed (immutable history)
-- --------------------------------------------------------------------------
CREATE TABLE public.mm_audit_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_document_id  uuid NOT NULL REFERENCES public.mm_aircraft_documents(id) ON DELETE CASCADE,
  campaign_id           uuid REFERENCES public.mm_audit_campaigns(id) ON DELETE SET NULL,
  audited_revision      text NOT NULL,
  audit_date            date NOT NULL,
  next_due_date         date NOT NULL GENERATED ALWAYS AS (audit_date + 90) STORED,
  audited_by            uuid REFERENCES public.profiles(id),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mm_audit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_audit_records_select" ON public.mm_audit_records
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mm_audit_records_insert" ON public.mm_audit_records
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_audit_records_update" ON public.mm_audit_records
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_audit_records_delete" ON public.mm_audit_records
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- Index for fast lookups: latest audit per aircraft-document pair
CREATE INDEX idx_mm_audit_records_latest
  ON public.mm_audit_records (aircraft_document_id, audit_date DESC);

-- Index for campaign queries
CREATE INDEX idx_mm_audit_records_campaign
  ON public.mm_audit_records (campaign_id)
  WHERE campaign_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 6. mm_mel_tracking — MEL / Policy Letter per aircraft type
-- --------------------------------------------------------------------------
CREATE TABLE public.mm_mel_tracking (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_family    text NOT NULL,
  document_type   text NOT NULL CHECK (document_type IN ('mmel', 'policy_letter')),
  document_number text NOT NULL,
  revision_number text,
  revision_date   date,
  review_date     date,
  next_due_date   date,
  update_needed   boolean NOT NULL DEFAULT false,
  updated_by      uuid REFERENCES public.profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mm_mel_tracking_unique UNIQUE (model_family, document_type, document_number)
);

ALTER TABLE public.mm_mel_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mm_mel_select" ON public.mm_mel_tracking
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "mm_mel_insert" ON public.mm_mel_tracking
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_mel_update" ON public.mm_mel_tracking
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "mm_mel_delete" ON public.mm_mel_tracking
  FOR DELETE USING (is_admin_or_super(auth.uid()));
