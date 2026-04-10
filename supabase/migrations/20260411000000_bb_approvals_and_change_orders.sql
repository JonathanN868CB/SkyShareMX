-- ============================================================================
-- BEET BOX — Quote/Change-Order Approvals + Mid-WO Discrepancy Flow
-- ============================================================================
-- Adds a full customer-approval loop for quotes and change orders (drawn
-- signature via tokenized public portal), plus the schema needed to raise
-- discrepancies against inspection items mid-WO and bundle them into Change
-- Orders.
--
-- Shape decisions:
--   * Change Orders reuse bb_work_orders via wo_type='change_order' with a
--     new parent_wo_id FK. CO items live in bb_work_order_items just like
--     WO/quote items (ownership moves from parent WO → CO at CO creation).
--   * Per-item customer decisions live on bb_work_order_items via a new
--     customer_approval_status column (pending/approved/declined).
--   * A new bb_approval_requests table holds one tokenized public link per
--     send; bb_approval_submissions captures the signature; per-item
--     responses go in bb_approval_item_decisions.
--   * Mid-WO "Found Discrepancy" items link to their source inspection item
--     via parent_item_id and carry an airworthy/recommendation tag.
--   * Photos for WO items (primarily discrepancies) live in a new
--     bb_wo_item_attachments table + bb-wo-attachments storage bucket.
-- ============================================================================


-- ─── 1. Extend wo_type discriminator to include 'change_order' ──────────────

ALTER TABLE public.bb_work_orders
  DROP CONSTRAINT IF EXISTS bb_work_orders_wo_type_check;

ALTER TABLE public.bb_work_orders
  ADD CONSTRAINT bb_work_orders_wo_type_check
  CHECK (wo_type IN ('work_order', 'quote', 'change_order'));


-- ─── 2. Parent-WO link for change orders ────────────────────────────────────
-- NULL for work_orders and quotes; set for change_orders.

ALTER TABLE public.bb_work_orders
  ADD COLUMN parent_wo_id uuid REFERENCES public.bb_work_orders(id) ON DELETE CASCADE;

CREATE INDEX idx_bb_work_orders_parent_wo_id
  ON public.bb_work_orders (parent_wo_id)
  WHERE parent_wo_id IS NOT NULL;


-- ─── 3. quote_status enum is reused for change orders ──────────────────────
-- Broaden the existing integrity constraint so CO rows also require a status.

ALTER TABLE public.bb_work_orders
  DROP CONSTRAINT IF EXISTS bb_work_orders_quote_status_check;

ALTER TABLE public.bb_work_orders
  ADD CONSTRAINT bb_work_orders_approval_status_check
  CHECK (
    (wo_type IN ('quote', 'change_order') AND quote_status IS NOT NULL)
    OR wo_type = 'work_order'
  );


-- ─── 4. Change-order numbering sequence (CO-YY-NNNN) ───────────────────────

CREATE SEQUENCE IF NOT EXISTS public.bb_change_order_number_seq;


-- ─── 5. Per-item customer approval + inspection→discrepancy linkage ────────

CREATE TYPE public.bb_item_approval_status AS ENUM (
  'pending',
  'approved',
  'declined'
);

ALTER TABLE public.bb_work_order_items
  ADD COLUMN customer_approval_status public.bb_item_approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN customer_decision_at     timestamptz,
  ADD COLUMN parent_item_id           uuid REFERENCES public.bb_work_order_items(id) ON DELETE SET NULL,
  ADD COLUMN discrepancy_type         text
    CHECK (discrepancy_type IS NULL OR discrepancy_type IN ('airworthy', 'recommendation'));

CREATE INDEX idx_bb_wo_items_parent_item_id
  ON public.bb_work_order_items (parent_item_id)
  WHERE parent_item_id IS NOT NULL;

CREATE INDEX idx_bb_wo_items_approval_status
  ON public.bb_work_order_items (work_order_id, customer_approval_status);


-- ─── 6. Approval requests (tokenized public link) ──────────────────────────

CREATE TYPE public.bb_approval_kind AS ENUM ('quote', 'change_order');

CREATE TABLE public.bb_approval_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id     uuid NOT NULL REFERENCES public.bb_work_orders(id) ON DELETE CASCADE,
  kind              public.bb_approval_kind NOT NULL,
  token             uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Manual recipient entry (not pulled from clients table)
  recipient_name    text NOT NULL,
  recipient_email   text NOT NULL,

  -- Snapshot taken at send-time for immutability
  snapshot_total    numeric(12,2) NOT NULL DEFAULT 0,
  snapshot_payload  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Outbound PDF path inside bb-approvals bucket
  unsigned_pdf_path text,

  status            text NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'submitted', 'expired', 'revoked')),
  expires_at        timestamptz,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  sent_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at      timestamptz,

  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_approval_req_wo    ON public.bb_approval_requests (work_order_id);
CREATE INDEX idx_bb_approval_req_token ON public.bb_approval_requests (token);
CREATE INDEX idx_bb_approval_req_user  ON public.bb_approval_requests (user_id);

CREATE TRIGGER trg_bb_approval_requests_updated_at
  BEFORE UPDATE ON public.bb_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();


-- ─── 7. Customer submission (one per approval request) ────────────────────
-- Holds the drawn signature image + hash fingerprint.

CREATE TABLE public.bb_approval_submissions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id    uuid NOT NULL UNIQUE REFERENCES public.bb_approval_requests(id) ON DELETE CASCADE,

  signer_name            text NOT NULL,
  signer_email           text NOT NULL,
  signer_title           text,

  -- SHA-256(name:email:approval_request_id:timestamp) — computed client-side
  signature_hash         text NOT NULL,
  -- PNG of the drawn canvas, stored at bb-approvals/{token}/signature.png
  signature_image_path   text NOT NULL,
  -- Server-rendered signed PDF path inside bb-approvals bucket
  signed_pdf_path        text,

  submitted_at           timestamptz NOT NULL DEFAULT now(),
  submitter_ip           text,
  user_agent             text
);

CREATE INDEX idx_bb_approval_sub_req ON public.bb_approval_submissions (approval_request_id);


-- ─── 8. Per-item accept/decline decisions ─────────────────────────────────

CREATE TABLE public.bb_approval_item_decisions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id    uuid NOT NULL REFERENCES public.bb_approval_requests(id) ON DELETE CASCADE,
  wo_item_id             uuid NOT NULL REFERENCES public.bb_work_order_items(id) ON DELETE CASCADE,
  decision               public.bb_item_approval_status NOT NULL,
  decided_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (approval_request_id, wo_item_id)
);

CREATE INDEX idx_bb_approval_dec_req  ON public.bb_approval_item_decisions (approval_request_id);
CREATE INDEX idx_bb_approval_dec_item ON public.bb_approval_item_decisions (wo_item_id);


-- ─── 9. WO item attachments (photos for discrepancies, etc.) ──────────────

CREATE TABLE public.bb_wo_item_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_item_id      uuid NOT NULL REFERENCES public.bb_work_order_items(id) ON DELETE CASCADE,
  work_order_id   uuid NOT NULL REFERENCES public.bb_work_orders(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'photo'
                  CHECK (kind IN ('photo', 'doc', 'other')),
  file_name       text NOT NULL,
  storage_path    text NOT NULL,   -- bb-wo-attachments/{woId}/{itemId}/{uuid}-{fname}
  mime_type       text,
  file_size_bytes integer,
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_wo_item_attach_item ON public.bb_wo_item_attachments (wo_item_id);
CREATE INDEX idx_bb_wo_item_attach_wo   ON public.bb_wo_item_attachments (work_order_id);


-- ─── 10. Storage buckets (private; access via signed URLs) ────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bb-approvals',      'bb-approvals',      false),
  ('bb-wo-attachments', 'bb-wo-attachments', false)
ON CONFLICT (id) DO NOTHING;


-- ─── 11. RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.bb_approval_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_approval_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_approval_item_decisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_wo_item_attachments      ENABLE ROW LEVEL SECURITY;

-- Authed read (mirrors bb_work_orders visibility)
CREATE POLICY "bb_approval_requests_select"
  ON public.bb_approval_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_approval_submissions_select"
  ON public.bb_approval_submissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_approval_item_decisions_select"
  ON public.bb_approval_item_decisions FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_wo_item_attachments_select"
  ON public.bb_wo_item_attachments FOR SELECT TO authenticated USING (true);

-- Manager+ may create/update/delete approval requests from the authed app.
-- Public-portal mutations bypass RLS via the Netlify service-role functions.
CREATE POLICY "bb_approval_requests_insert"
  ON public.bb_approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_approval_requests_update"
  ON public.bb_approval_requests FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_approval_requests_delete"
  ON public.bb_approval_requests FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
  );

-- bb_approval_submissions and bb_approval_item_decisions are written by the
-- service-role Netlify function during public-portal submit. Do NOT grant
-- authenticated writes here — they'd bypass the submit workflow's validation.

-- Attachments: assigned mechanics on the WO may insert; Manager+ may delete.
CREATE POLICY "bb_wo_item_attachments_insert"
  ON public.bb_wo_item_attachments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
    OR EXISTS (
      SELECT 1
      FROM public.bb_work_order_mechanics wom
      WHERE wom.work_order_id = bb_wo_item_attachments.work_order_id
        AND wom.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "bb_wo_item_attachments_delete"
  ON public.bb_wo_item_attachments FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
  );


-- ─── 12. Storage bucket policies ──────────────────────────────────────────
-- bb-approvals: only service-role writes; authed users get signed URLs
-- through Netlify functions, not direct access.
-- bb-wo-attachments: authed Manager+ or assigned mechanics may upload;
-- read is via signed URLs (also via Netlify function for the public portal).

CREATE POLICY "bb_approvals_service_only_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'bb-approvals' AND false)
  WITH CHECK (bucket_id = 'bb-approvals' AND false);

-- Note: mechanic uploads (for users without Manager role) go through the
-- Netlify function with the service role, which bypasses this policy.
CREATE POLICY "bb_wo_attachments_authed_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bb-wo-attachments'
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid())
          IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_wo_attachments_authed_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bb-wo-attachments');

CREATE POLICY "bb_wo_attachments_mgr_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bb-wo-attachments'
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid())
          IN ('Manager', 'Admin', 'Super Admin')
  );
