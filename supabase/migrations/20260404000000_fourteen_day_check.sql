-- ============================================================================
-- 14-Day Check — Schema
-- Permanent standing checklist system for recurring aircraft inspections.
-- Each aircraft gets one token (permanent URL). Every mechanic visit creates
-- a new submission row. MC reviews photos inline and archives.
-- ============================================================================

-- ============================================================================
-- 1. inspection_card_templates — one row per aircraft type
-- ============================================================================

CREATE TABLE public.inspection_card_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,         -- e.g. "Citation 525A / CJ2 — 14-Day Check"
  aircraft_type text,                  -- e.g. "CJ2"
  field_schema  jsonb NOT NULL DEFAULT '[]',
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_card_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ict_select" ON public.inspection_card_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ict_insert" ON public.inspection_card_templates
  FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "ict_update" ON public.inspection_card_templates
  FOR UPDATE USING (is_admin_or_super(auth.uid()));

CREATE POLICY "ict_delete" ON public.inspection_card_templates
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- ============================================================================
-- 2. fourteen_day_check_tokens — permanent standing token per aircraft (1:1)
-- ============================================================================

CREATE TABLE public.fourteen_day_check_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id  uuid NOT NULL UNIQUE REFERENCES public.aircraft(id) ON DELETE CASCADE,
  token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  field_schema jsonb NOT NULL DEFAULT '[]',   -- snapshot from template at creation time
  traxxall_url text,                           -- optional deep link to Traxxall item
  template_id  uuid REFERENCES public.inspection_card_templates(id),
  created_by   uuid NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fdct_aircraft ON public.fourteen_day_check_tokens(aircraft_id);
CREATE INDEX idx_fdct_token    ON public.fourteen_day_check_tokens(token);

ALTER TABLE public.fourteen_day_check_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdct_select" ON public.fourteen_day_check_tokens
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "fdct_insert" ON public.fourteen_day_check_tokens
  FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "fdct_update" ON public.fourteen_day_check_tokens
  FOR UPDATE USING (is_admin_or_super(auth.uid()));

CREATE POLICY "fdct_delete" ON public.fourteen_day_check_tokens
  FOR DELETE USING (is_admin_or_super(auth.uid()));

-- ============================================================================
-- 3. fourteen_day_check_submissions — one row per completed check event
-- ============================================================================

CREATE TABLE public.fourteen_day_check_submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id       uuid NOT NULL REFERENCES public.fourteen_day_check_tokens(id),
  aircraft_id    uuid NOT NULL REFERENCES public.aircraft(id),  -- denormalized for fleet queries
  submitter_name text NOT NULL,
  field_values   jsonb NOT NULL DEFAULT '{}',
  notes          text,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  submitter_ip   text,
  review_status  text NOT NULL DEFAULT 'pending'
                 CHECK (review_status IN ('pending', 'flagged', 'cleared', 'archived')),
  review_notes   text,
  reviewed_by    uuid REFERENCES public.profiles(id),
  reviewed_at    timestamptz
);

CREATE INDEX idx_fdcs_token        ON public.fourteen_day_check_submissions(token_id);
CREATE INDEX idx_fdcs_aircraft     ON public.fourteen_day_check_submissions(aircraft_id);
CREATE INDEX idx_fdcs_submitted_at ON public.fourteen_day_check_submissions(submitted_at DESC);
CREATE INDEX idx_fdcs_review       ON public.fourteen_day_check_submissions(review_status);

ALTER TABLE public.fourteen_day_check_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdcs_select" ON public.fourteen_day_check_submissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Writes handled by Netlify Functions (service role) — no direct client INSERT/UPDATE/DELETE

-- ============================================================================
-- 4. fourteen_day_check_attachments — photos per submission
-- ============================================================================

CREATE TABLE public.fourteen_day_check_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.fourteen_day_check_submissions(id) ON DELETE CASCADE,
  field_id        text NOT NULL,        -- which checklist field (e.g. "photo-left-tire")
  file_name       text NOT NULL,
  storage_path    text NOT NULL,        -- fourteen-day-checks/{token}/{submission_id}/{uuid}-{name}
  mime_type       text,
  file_size_bytes integer,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fdca_submission ON public.fourteen_day_check_attachments(submission_id);

ALTER TABLE public.fourteen_day_check_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdca_select" ON public.fourteen_day_check_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 5. Storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fourteen-day-checks', 'fourteen-day-checks', false, null, null)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fdcheck_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fourteen-day-checks');

-- ============================================================================
-- 6. Seed — CJ2 template + tokens for N868CB, N871CB, N774CB
-- ============================================================================

DO $$
DECLARE
  v_admin_id   uuid;
  v_template_id uuid;
  v_schema     jsonb;
BEGIN
  -- Use first Super Admin as the system seed author
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'Super Admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE NOTICE '14-Day Check seed skipped: no Super Admin profile found. Run again after first login.';
    RETURN;
  END IF;

  -- CJ2 field schema
  v_schema := '[
    {
      "id": "confirm-registration",
      "label": "I confirm I am standing at aircraft [REGISTRATION]",
      "type": "checkbox",
      "required": true,
      "hint": "Verify the tail number on the aircraft before proceeding"
    },
    {
      "id": "cabin-section",
      "label": "CABIN & INTERIOR",
      "type": "section",
      "required": false
    },
    {
      "id": "window-shades",
      "label": "Window shades checked",
      "type": "checkbox",
      "required": true
    },
    {
      "id": "cabin-chairs",
      "label": "Cabin chair functionality checked",
      "type": "checkbox",
      "required": true
    },
    {
      "id": "aircraft-binder",
      "label": "Aircraft binder present",
      "type": "checkbox",
      "required": true
    },
    {
      "id": "aircraft-keys",
      "label": "Aircraft keys present",
      "type": "checkbox",
      "required": true
    },
    {
      "id": "fluid-section",
      "label": "FLUID CHECK",
      "type": "section",
      "required": false
    },
    {
      "id": "fluid-check",
      "label": "Quick fluid check completed",
      "type": "checkbox",
      "required": true
    },
    {
      "id": "fluid-notes",
      "label": "Fluid check notes",
      "type": "textarea",
      "required": false,
      "hint": "Note any abnormalities found"
    },
    {
      "id": "photos-section",
      "label": "PHOTOS",
      "type": "section",
      "required": false
    },
    {
      "id": "photo-left-tire",
      "label": "Left main landing gear tire",
      "type": "photo",
      "required": true
    },
    {
      "id": "photo-left-brake",
      "label": "Left brake",
      "type": "photo",
      "required": true
    },
    {
      "id": "photo-right-tire",
      "label": "Right main landing gear tire",
      "type": "photo",
      "required": true
    },
    {
      "id": "photo-right-brake",
      "label": "Right brake",
      "type": "photo",
      "required": true
    },
    {
      "id": "photo-exterior",
      "label": "Aircraft exterior (overall)",
      "type": "photo",
      "required": true
    }
  ]'::jsonb;

  -- Insert CJ2 template
  INSERT INTO public.inspection_card_templates (name, aircraft_type, field_schema, created_by)
  VALUES ('Citation 525A / CJ2 — 14-Day Check', 'CJ2', v_schema, v_admin_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_template_id;

  -- If template already existed, look it up
  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
    FROM public.inspection_card_templates
    WHERE aircraft_type = 'CJ2'
    LIMIT 1;
  END IF;

  -- Insert tokens for the three CJ2s (skip any that don't exist in aircraft table)
  INSERT INTO public.fourteen_day_check_tokens
    (aircraft_id, field_schema, template_id, created_by)
  SELECT
    a.id,
    v_schema,
    v_template_id,
    v_admin_id
  FROM public.aircraft a
  JOIN public.aircraft_registrations ar
    ON ar.aircraft_id = a.id AND ar.is_current = true
  WHERE ar.registration IN ('N868CB', 'N871CB', 'N774CB')
  ON CONFLICT (aircraft_id) DO NOTHING;

END $$;
