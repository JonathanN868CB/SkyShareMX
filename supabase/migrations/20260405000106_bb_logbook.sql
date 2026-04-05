-- ============================================================
-- BEET BOX — Phase 0g: Logbook (2 tables)
-- ============================================================

CREATE TABLE public.bb_logbook_entries (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number            text NOT NULL UNIQUE,
  aircraft_id             uuid REFERENCES public.aircraft(id) ON DELETE RESTRICT,
  guest_registration      text,
  guest_serial            text,
  CONSTRAINT bb_logbook_aircraft_required CHECK (
    aircraft_id IS NOT NULL OR guest_registration IS NOT NULL
  ),
  work_order_id           uuid REFERENCES public.bb_work_orders(id) ON DELETE SET NULL,
  wo_number               text,
  entry_date              date NOT NULL DEFAULT CURRENT_DATE,
  total_aircraft_time     numeric(10,1),
  total_aircraft_time_new numeric(10,1),
  landings                integer,
  landings_new            integer,
  hobbs                   numeric(10,1),
  hobbs_new               numeric(10,1),
  section_title           text NOT NULL DEFAULT 'Airframe Entries',
  logbook_section         bb_logbook_section NOT NULL DEFAULT 'Airframe',
  return_to_service       text NOT NULL DEFAULT '',
  mechanic_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mechanic_name           text NOT NULL DEFAULT '',
  certificate_type        bb_cert_type NOT NULL DEFAULT 'A&P',
  certificate_number      text NOT NULL DEFAULT '',
  is_ria                  boolean NOT NULL DEFAULT false,
  inspector_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  inspector_name          text,
  inspector_cert          text,
  status                  bb_logbook_entry_status NOT NULL DEFAULT 'draft',
  signed_at               timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_logbook_aircraft   ON public.bb_logbook_entries(aircraft_id);
CREATE INDEX idx_bb_logbook_wo         ON public.bb_logbook_entries(work_order_id);
CREATE INDEX idx_bb_logbook_entry_date ON public.bb_logbook_entries(entry_date DESC);
CREATE INDEX idx_bb_logbook_status     ON public.bb_logbook_entries(status);

CREATE TRIGGER trg_bb_logbook_updated_at
  BEFORE UPDATE ON public.bb_logbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

CREATE TABLE public.bb_logbook_entry_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES public.bb_logbook_entries(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  text        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, line_number)
);

CREATE INDEX idx_bb_logbook_lines_entry ON public.bb_logbook_entry_lines(entry_id);

ALTER TABLE public.bb_logbook_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_logbook_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_logbook_entries_select" ON public.bb_logbook_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_logbook_entries_insert"
  ON public.bb_logbook_entries FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Technician', 'Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_logbook_entries_update"
  ON public.bb_logbook_entries FOR UPDATE TO authenticated
  USING (
    status = 'draft'
    AND (
      mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    )
  );

CREATE POLICY "bb_logbook_entries_delete"
  ON public.bb_logbook_entries FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_logbook_lines_select" ON public.bb_logbook_entry_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_logbook_lines_insert"
  ON public.bb_logbook_entry_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bb_logbook_entries e
      WHERE e.id = entry_id AND e.status = 'draft'
        AND (
          e.mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
        )
    )
  );

CREATE POLICY "bb_logbook_lines_update"
  ON public.bb_logbook_entry_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bb_logbook_entries e
      WHERE e.id = entry_id AND e.status = 'draft'
        AND (
          e.mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
        )
    )
  );

CREATE POLICY "bb_logbook_lines_delete"
  ON public.bb_logbook_entry_lines FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
