-- ============================================================================
-- External Requests — Schema
-- Outreach engine: send structured requests to external people via email,
-- collect responses via tokenized public portal, review before acting.
-- ============================================================================

-- 1. Add 'External Requests' to the app_section enum
ALTER TYPE app_section ADD VALUE IF NOT EXISTS 'External Requests';

-- 2. external_requests — one row per outreach instance
CREATE TABLE external_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL,
  instructions     text,
  field_schema     jsonb NOT NULL DEFAULT '[]',   -- snapshot array of FieldDef objects

  recipient_name   text NOT NULL,
  recipient_email  text NOT NULL,
  delivery_channel text NOT NULL DEFAULT 'email', -- 'email' | 'sms' (sms reserved for V2)

  token            uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'sent', 'submitted', 'reviewed')),
  expires_at       timestamptz,

  -- Cross-tab context (flat columns — populated by other tabs in V2, empty in V1)
  parent_type      text CHECK (parent_type IS NULL OR parent_type IN (
                     'aircraft', 'vendor', 'compliance', 'project', 'conformity'
                   )),
  parent_id        uuid,
  parent_label     text,

  -- Internal review
  review_notes     text,

  -- Audit
  created_by       uuid NOT NULL REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES profiles(id)
);

-- 3. external_submissions — what the external person sent back (1:1 with request)
CREATE TABLE external_submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid UNIQUE NOT NULL REFERENCES external_requests(id) ON DELETE CASCADE,
  field_values   jsonb NOT NULL DEFAULT '{}',   -- { fieldId: value }
  notes          text,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  submitter_ip   text
);

-- 4. external_submission_attachments — files uploaded with a submission
CREATE TABLE external_submission_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES external_submissions(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  storage_path    text NOT NULL,  -- external-submissions/{token}/{uuid}-{originalName}
  mime_type       text,
  file_size_bytes integer,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_external_requests_status         ON external_requests(status);
CREATE INDEX idx_external_requests_created_by     ON external_requests(created_by);
CREATE INDEX idx_external_requests_token          ON external_requests(token);
CREATE INDEX idx_external_requests_submitted_at   ON external_requests(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX idx_external_submissions_request     ON external_submissions(request_id);
CREATE INDEX idx_external_attachments_submission  ON external_submission_attachments(submission_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE external_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_submission_attachments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all external requests
CREATE POLICY "Authenticated users can read external_requests"
  ON external_requests FOR SELECT TO authenticated USING (true);

-- Any authenticated user can create a request
CREATE POLICY "Authenticated users can insert external_requests"
  ON external_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Only the creator (or admin) can update a request
CREATE POLICY "Creator or admin can update external_requests"
  ON external_requests FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin')
    )
  );

-- Only admin or creator can delete a request (cleanup goes through Netlify Function)
CREATE POLICY "Creator or admin can delete external_requests"
  ON external_requests FOR DELETE TO authenticated
  USING (
    created_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin')
    )
  );

-- Authenticated users can read submissions and attachments
CREATE POLICY "Authenticated users can read external_submissions"
  ON external_submissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read external_submission_attachments"
  ON external_submission_attachments FOR SELECT TO authenticated USING (true);

-- No direct client INSERT on submissions or attachments — all writes via Netlify Functions (service role)

-- ============================================================================
-- Supabase Storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('external-submissions', 'external-submissions', false, null, null)
ON CONFLICT (id) DO NOTHING;

-- Internal users can list and read objects in the bucket (for signed download URL generation)
CREATE POLICY "Authenticated users can read external-submissions storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'external-submissions');

-- Service role handles all inserts/deletes via Netlify Functions (no client policy needed)
