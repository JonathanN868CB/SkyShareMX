-- ============================================================
-- BEET BOX — Phase 0e: Tool Calibration (2 tables)
-- ============================================================

CREATE TABLE public.bb_tools (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_number               text NOT NULL UNIQUE,
  description               text NOT NULL,
  serial_number             text,
  manufacturer              text,
  location                  text,
  status                    bb_tool_status NOT NULL DEFAULT 'active',
  calibration_interval_days integer NOT NULL DEFAULT 365,
  last_calibrated_at        date,
  next_calibration_due      date,
  calibration_vendor        text,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_tools_status   ON public.bb_tools(status);
CREATE INDEX idx_bb_tools_due_date ON public.bb_tools(next_calibration_due);

CREATE TRIGGER trg_bb_tools_updated_at
  BEFORE UPDATE ON public.bb_tools
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

CREATE TABLE public.bb_calibration_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id            uuid NOT NULL REFERENCES public.bb_tools(id) ON DELETE CASCADE,
  calibrated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  calibrated_by_name text NOT NULL DEFAULT '',
  calibrated_at      date NOT NULL,
  next_due           date NOT NULL,
  certificate_number text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_calibration_tool ON public.bb_calibration_records(tool_id);
CREATE INDEX idx_bb_calibration_date ON public.bb_calibration_records(calibrated_at DESC);

ALTER TABLE public.bb_tools               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_calibration_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_tools_select" ON public.bb_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_tools_insert"
  ON public.bb_tools FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_tools_update"
  ON public.bb_tools FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_tools_delete"
  ON public.bb_tools FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_calibration_select" ON public.bb_calibration_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_calibration_insert"
  ON public.bb_calibration_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Technician', 'Manager', 'Admin', 'Super Admin'));
