-- ============================================================================
-- Vendor Reports — report history + storage bucket
-- ============================================================================

-- ── Report history table ───────────────────────────────────────────────────

CREATE TABLE vendor_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type     text NOT NULL
    CHECK (report_type IN ('vendor_roster', 'vendor_audit', 'compliance_summary')),
  title           text NOT NULL,
  description     text,

  -- Output
  file_format     text NOT NULL DEFAULT 'pdf'
    CHECK (file_format IN ('pdf', 'csv')),
  file_path       text,                          -- path in Supabase Storage bucket
  file_size       bigint,

  -- Scope / filters used
  lane_filter     text CHECK (lane_filter IN ('all', 'nine', 'ten')),
  status_filter   text,                          -- operational_status filter, NULL = all
  date_range_start date,                         -- for compliance summaries
  date_range_end   date,

  -- Provenance
  generated_by    uuid REFERENCES auth.users(id),
  generated_at    timestamptz NOT NULL DEFAULT now(),

  -- Soft state
  notes           text
);

-- Indexes
CREATE INDEX idx_vendor_reports_type     ON vendor_reports (report_type);
CREATE INDEX idx_vendor_reports_gen_at   ON vendor_reports (generated_at DESC);
CREATE INDEX idx_vendor_reports_gen_by   ON vendor_reports (generated_by);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE vendor_reports ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read reports
CREATE POLICY vendor_reports_select ON vendor_reports
  FOR SELECT TO authenticated USING (true);

-- Manager+ can generate (insert) reports
CREATE POLICY vendor_reports_insert ON vendor_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Super Admin', 'Admin', 'Manager')
    )
  );

-- Admin+ can delete old reports
CREATE POLICY vendor_reports_delete ON vendor_reports
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Super Admin', 'Admin')
    )
  );

-- ── Storage bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-reports',
  'vendor-reports',
  false,
  52428800,  -- 50 MB
  ARRAY['application/pdf', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can read; Manager+ can upload
CREATE POLICY vendor_reports_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vendor-reports');

CREATE POLICY vendor_reports_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-reports'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Super Admin', 'Admin', 'Manager')
    )
  );

CREATE POLICY vendor_reports_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-reports'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Super Admin', 'Admin')
    )
  );
