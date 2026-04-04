-- ============================================================================
-- 14-Day Check — Enroll remaining 23 aircraft
-- Uses the existing CJ2 template field schema as a universal placeholder.
-- Type-specific schemas will be applied per aircraft type as templates are built.
-- ============================================================================

DO $$
DECLARE
  v_admin_id   uuid;
  v_template_id uuid;
  v_schema      jsonb;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'Super Admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '14-Day Check fleet enroll: no Super Admin profile found.';
  END IF;

  SELECT id, field_schema
    INTO v_template_id, v_schema
    FROM public.inspection_card_templates
   WHERE aircraft_type = 'CJ2'
   LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION '14-Day Check fleet enroll: CJ2 template not found.';
  END IF;

  -- Insert tokens for every aircraft that doesn't already have one
  INSERT INTO public.fourteen_day_check_tokens
    (aircraft_id, field_schema, template_id, created_by)
  SELECT a.id, v_schema, v_template_id, v_admin_id
  FROM public.aircraft a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fourteen_day_check_tokens t WHERE t.aircraft_id = a.id
  )
  ON CONFLICT (aircraft_id) DO NOTHING;

  RAISE NOTICE '14-Day Check: enrolled % aircraft.',
    (SELECT COUNT(*) FROM public.fourteen_day_check_tokens);
END $$;
