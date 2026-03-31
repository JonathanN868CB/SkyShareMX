-- ============================================================================
-- VENDOR GOVERNANCE: DUAL-LANE COMPLIANCE MODEL
-- Migration: 20260331000002
-- Purpose: Establish the foundational data model for 9-or-less and 10-or-more
--          vendor compliance lanes with full audit trail.
--
-- This migration is ADDITIVE ONLY. It does not alter existing vendor columns,
-- does not break the current VendorMap UI, and does not remove any data.
-- ============================================================================

-- ── 1. Add governance columns to vendors table ──────────────────────────────

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags              text[] DEFAULT '{}';

COMMENT ON COLUMN public.vendors.operational_status IS
  'Shared top-level status: discovered | pending | approved | restricted | inactive | archived';
COMMENT ON COLUMN public.vendors.tags IS
  'Freeform searchable labels (replaces vendor_type as primary classification over time)';

-- Back-fill: existing active vendors → "approved" (they were already in use);
-- inactive vendors → "inactive"
UPDATE public.vendors SET operational_status = 'approved'  WHERE active = true;
UPDATE public.vendors SET operational_status = 'inactive'  WHERE active = false;

CREATE INDEX IF NOT EXISTS vendors_operational_status_idx ON public.vendors(operational_status);
CREATE INDEX IF NOT EXISTS vendors_tags_idx              ON public.vendors USING gin(tags);

-- ── 2. 9-or-less compliance lane ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_lane_nine (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id                uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  status                   text NOT NULL DEFAULT 'not_evaluated',
    -- not_evaluated | usable | pending_review | restricted | not_applicable
  capability_scope         text,
  ap_certificate_verified  boolean NOT NULL DEFAULT false,
  ap_certificate_number    text,
  last_review_date         date,
  next_review_due          date,
  approved_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at              timestamptz,
  warnings                 text[] DEFAULT '{}',
  notes                    text,
  updated_at               timestamptz DEFAULT now(),
  updated_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT vendor_lane_nine_vendor_unique UNIQUE (vendor_id)
);

COMMENT ON TABLE public.vendor_lane_nine IS
  '9-or-less aircraft compliance lane. Transactional: can this vendor do the work and properly return the aircraft to service?';
COMMENT ON COLUMN public.vendor_lane_nine.status IS
  'not_evaluated | usable | pending_review | restricted | not_applicable';

CREATE INDEX IF NOT EXISTS vendor_lane_nine_status_idx ON public.vendor_lane_nine(status);
CREATE INDEX IF NOT EXISTS vendor_lane_nine_next_review_idx ON public.vendor_lane_nine(next_review_due)
  WHERE next_review_due IS NOT NULL;

-- RLS
ALTER TABLE public.vendor_lane_nine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lane_nine_select" ON public.vendor_lane_nine
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "lane_nine_insert" ON public.vendor_lane_nine
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "lane_nine_update" ON public.vendor_lane_nine
  FOR UPDATE USING (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "lane_nine_delete" ON public.vendor_lane_nine
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- ── 3. 10-or-more provider governance lane ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_lane_ten (
  id                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id                  uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  status                     text NOT NULL DEFAULT 'not_evaluated',
    -- not_evaluated | recurring_approved | ad_hoc_only | pending_review
    -- | expired | restricted | inactive
  crs_number                 text,
  drug_abatement_verified    boolean NOT NULL DEFAULT false,
  insurance_verified         boolean NOT NULL DEFAULT false,
  authorization_scope        text,
  last_audit_date            date,
  next_audit_due             date,
  last_oversight_review      date,
  next_oversight_review_due  date,
  gmm_form_complete          boolean NOT NULL DEFAULT false,
  isbao_rating               text,
  argus_rating               text,
  approved_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at                timestamptz,
  warnings                   text[] DEFAULT '{}',
  notes                      text,
  updated_at                 timestamptz DEFAULT now(),
  updated_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT vendor_lane_ten_vendor_unique UNIQUE (vendor_id)
);

COMMENT ON TABLE public.vendor_lane_ten IS
  '10-or-more aircraft provider governance lane. This is contract maintenance provider oversight under SkyShare maintenance program, not simple vendor selection.';
COMMENT ON COLUMN public.vendor_lane_ten.status IS
  'not_evaluated | recurring_approved | ad_hoc_only | pending_review | expired | restricted | inactive';

CREATE INDEX IF NOT EXISTS vendor_lane_ten_status_idx ON public.vendor_lane_ten(status);
CREATE INDEX IF NOT EXISTS vendor_lane_ten_next_audit_idx ON public.vendor_lane_ten(next_audit_due)
  WHERE next_audit_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_lane_ten_next_oversight_idx ON public.vendor_lane_ten(next_oversight_review_due)
  WHERE next_oversight_review_due IS NOT NULL;

-- RLS: 10-or-more lane is Admin+ only for writes (DOM/QA governance)
ALTER TABLE public.vendor_lane_ten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lane_ten_select" ON public.vendor_lane_ten
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "lane_ten_insert" ON public.vendor_lane_ten
  FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "lane_ten_update" ON public.vendor_lane_ten
  FOR UPDATE USING (is_admin_or_super(auth.uid()));

CREATE POLICY "lane_ten_delete" ON public.vendor_lane_ten
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- ── 4. Vendor status history (audit trail) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_status_history (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id      uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  lane           text NOT NULL,
    -- 'shared' | 'nine' | 'ten'
  field_changed  text NOT NULL,
  old_value      text,
  new_value      text,
  changed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at     timestamptz DEFAULT now(),
  reason         text
);

COMMENT ON TABLE public.vendor_status_history IS
  'Immutable audit trail for all vendor status and field changes. lane = shared | nine | ten.';

CREATE INDEX IF NOT EXISTS vendor_status_history_vendor_idx
  ON public.vendor_status_history(vendor_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS vendor_status_history_lane_idx
  ON public.vendor_status_history(lane);

-- RLS: everyone reads; Manager+ writes (inserts only, no updates/deletes)
ALTER TABLE public.vendor_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_history_select" ON public.vendor_status_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "status_history_insert" ON public.vendor_status_history
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

-- No update or delete policies: audit trail is append-only

-- ── 5. Vendor review events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_review_events (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id      uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  lane           text NOT NULL,
    -- 'nine' | 'ten'
  review_type    text NOT NULL,
    -- initial_eval | annual_review | audit | spot_check | ad_hoc | surveillance
  review_date    date NOT NULL,
  conducted_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome        text,
    -- passed | failed | conditional | deferred
  notes          text,
  next_due       date,
  created_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE public.vendor_review_events IS
  'Structured review/audit/surveillance records per vendor per lane.';

CREATE INDEX IF NOT EXISTS vendor_review_events_vendor_idx
  ON public.vendor_review_events(vendor_id, review_date DESC);
CREATE INDEX IF NOT EXISTS vendor_review_events_next_due_idx
  ON public.vendor_review_events(next_due)
  WHERE next_due IS NOT NULL;

-- RLS
ALTER TABLE public.vendor_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_events_select" ON public.vendor_review_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "review_events_insert" ON public.vendor_review_events
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "review_events_update" ON public.vendor_review_events
  FOR UPDATE USING (is_admin_or_super(auth.uid()));

-- No delete: review records are permanent

-- ── 6. Vendor documents (with lane + expiry + verification) ─────────────────

CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  lane            text NOT NULL DEFAULT 'shared',
    -- 'shared' | 'nine' | 'ten'
  document_type   text NOT NULL DEFAULT 'other',
    -- Shared:  insurance_cert | w9 | other
    -- Nine:    ap_license_copy | rts_evidence | other
    -- Ten:     air_agency_cert | drug_alcohol_program | argus_report
    --          | isbao_report | gmm_approval_form | gom_form | other
  document_name   text NOT NULL,
  file_path       text NOT NULL,
  file_size       bigint,
  expires_at      date,
    -- NULL = no expiry / N/A (default). Set when document has a known expiry.
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at     timestamptz DEFAULT now(),
  verified        boolean NOT NULL DEFAULT false,
  verified_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  notes           text
);

COMMENT ON COLUMN public.vendor_documents.expires_at IS
  'NULL means no expiry (N/A). Populated when the document has a known expiration or audit-due date.';
COMMENT ON COLUMN public.vendor_documents.lane IS
  'Which compliance lane this document supports: shared | nine | ten';

CREATE INDEX IF NOT EXISTS vendor_documents_vendor_idx
  ON public.vendor_documents(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_documents_lane_idx
  ON public.vendor_documents(lane);
CREATE INDEX IF NOT EXISTS vendor_documents_expires_idx
  ON public.vendor_documents(expires_at)
  WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_docs_select" ON public.vendor_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "vendor_docs_insert" ON public.vendor_documents
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid())
    OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "vendor_docs_delete" ON public.vendor_documents
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- ── 7. Storage bucket for vendor documents ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-documents',
  'vendor-documents',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies
CREATE POLICY "vendor_docs_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendor-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "vendor_docs_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vendor-documents'
    AND auth.uid() IS NOT NULL
    AND (
      is_admin_or_super(auth.uid())
      OR get_user_role(auth.uid()) = 'Manager'
    )
  );

CREATE POLICY "vendor_docs_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vendor-documents'
    AND auth.uid() IS NOT NULL
    AND is_admin_or_super(auth.uid())
  );

-- ── 8. Auto-update updated_at triggers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER vendor_lane_nine_updated_at
  BEFORE UPDATE ON public.vendor_lane_nine
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER vendor_lane_ten_updated_at
  BEFORE UPDATE ON public.vendor_lane_ten
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
