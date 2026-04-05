-- ============================================================
-- BEET BOX — Phase 0b: Work Orders (5 tables)
-- ============================================================

CREATE TABLE public.bb_work_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number          text NOT NULL UNIQUE,
  aircraft_id        uuid REFERENCES public.aircraft(id) ON DELETE RESTRICT,
  guest_registration text,
  guest_serial       text,
  CONSTRAINT bb_wo_aircraft_required CHECK (
    aircraft_id IS NOT NULL OR guest_registration IS NOT NULL
  ),
  status             bb_wo_status NOT NULL DEFAULT 'draft',
  priority           bb_priority  NOT NULL DEFAULT 'routine',
  wo_type            text NOT NULL,
  description        text,
  opened_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at          timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,
  meter_at_open      numeric(10,1),
  meter_at_close     numeric(10,1),
  discrepancy_ref    text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_work_orders_status    ON public.bb_work_orders(status);
CREATE INDEX idx_bb_work_orders_aircraft  ON public.bb_work_orders(aircraft_id);
CREATE INDEX idx_bb_work_orders_opened_at ON public.bb_work_orders(opened_at DESC);

CREATE TRIGGER trg_bb_work_orders_updated_at
  BEFORE UPDATE ON public.bb_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

-- ── Assigned Mechanics ────────────────────────────────────────

CREATE TABLE public.bb_work_order_mechanics (
  work_order_id uuid NOT NULL REFERENCES public.bb_work_orders(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  assigned_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (work_order_id, profile_id)
);

CREATE INDEX idx_bb_wo_mechanics_profile ON public.bb_work_order_mechanics(profile_id);

-- ── Work Order Items ──────────────────────────────────────────

CREATE TABLE public.bb_work_order_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id         uuid NOT NULL REFERENCES public.bb_work_orders(id) ON DELETE CASCADE,
  item_number           integer NOT NULL,
  category              text NOT NULL,
  logbook_section       bb_logbook_section NOT NULL DEFAULT 'Airframe',
  task_number           text,
  part_number           text,
  serial_number         text,
  discrepancy           text NOT NULL DEFAULT '',
  corrective_action     text NOT NULL DEFAULT '',
  mechanic_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimated_hours       numeric(6,2) NOT NULL DEFAULT 0,
  labor_rate            numeric(8,2) NOT NULL DEFAULT 125,
  shipping_cost         numeric(10,2) NOT NULL DEFAULT 0,
  outside_services_cost numeric(10,2) NOT NULL DEFAULT 0,
  sign_off_required     boolean NOT NULL DEFAULT true,
  signed_off_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_off_at         timestamptz,
  item_status           bb_wo_item_status NOT NULL DEFAULT 'pending',
  no_parts_required     boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, item_number)
);

CREATE INDEX idx_bb_wo_items_work_order ON public.bb_work_order_items(work_order_id);
CREATE INDEX idx_bb_wo_items_mechanic   ON public.bb_work_order_items(mechanic_id);

CREATE TRIGGER trg_bb_wo_items_updated_at
  BEFORE UPDATE ON public.bb_work_order_items
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

-- ── Item Parts ────────────────────────────────────────────────

CREATE TABLE public.bb_work_order_item_parts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES public.bb_work_order_items(id) ON DELETE CASCADE,
  part_number text NOT NULL,
  description text NOT NULL DEFAULT '',
  qty         integer NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_wo_item_parts_item ON public.bb_work_order_item_parts(item_id);

-- ── Item Labor ────────────────────────────────────────────────

CREATE TABLE public.bb_work_order_item_labor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES public.bb_work_order_items(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.bb_work_orders(id) ON DELETE CASCADE,
  mechanic_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mechanic_name text NOT NULL,
  hours         numeric(5,2) NOT NULL,
  clocked_at    timestamptz NOT NULL DEFAULT now(),
  description   text,
  billable      boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_wo_labor_item     ON public.bb_work_order_item_labor(item_id);
CREATE INDEX idx_bb_wo_labor_wo       ON public.bb_work_order_item_labor(work_order_id);
CREATE INDEX idx_bb_wo_labor_mechanic ON public.bb_work_order_item_labor(mechanic_id);

-- ── Status History ────────────────────────────────────────────

CREATE TABLE public.bb_work_order_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.bb_work_orders(id) ON DELETE CASCADE,
  from_status   bb_wo_status,
  to_status     bb_wo_status NOT NULL,
  changed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  notes         text
);

CREATE INDEX idx_bb_wo_history_work_order ON public.bb_work_order_status_history(work_order_id);
CREATE INDEX idx_bb_wo_history_changed_at ON public.bb_work_order_status_history(changed_at DESC);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.bb_work_orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_work_order_mechanics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_work_order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_work_order_item_parts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_work_order_item_labor     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_work_order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_work_orders_select"       ON public.bb_work_orders               FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_wo_mechanics_select"      ON public.bb_work_order_mechanics      FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_wo_items_select"          ON public.bb_work_order_items          FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_wo_item_parts_select"     ON public.bb_work_order_item_parts     FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_wo_item_labor_select"     ON public.bb_work_order_item_labor     FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_wo_status_history_select" ON public.bb_work_order_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_work_orders_insert"
  ON public.bb_work_orders FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_work_orders_update"
  ON public.bb_work_orders FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_work_orders_delete"
  ON public.bb_work_orders FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_wo_mechanics_insert" ON public.bb_work_order_mechanics FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_wo_mechanics_delete" ON public.bb_work_order_mechanics FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_wo_items_insert"
  ON public.bb_work_order_items FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    OR mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "bb_wo_items_update"
  ON public.bb_work_order_items FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    OR mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "bb_wo_items_delete"
  ON public.bb_work_order_items FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_wo_item_parts_insert"
  ON public.bb_work_order_item_parts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    OR EXISTS (
      SELECT 1 FROM public.bb_work_order_items woi
      JOIN public.bb_work_order_mechanics wom ON wom.work_order_id = woi.work_order_id
      WHERE woi.id = item_id
        AND wom.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "bb_wo_item_parts_delete"
  ON public.bb_work_order_item_parts FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_wo_item_labor_insert"
  ON public.bb_work_order_item_labor FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    OR mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "bb_wo_item_labor_update"
  ON public.bb_work_order_item_labor FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    OR mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "bb_wo_item_labor_delete"
  ON public.bb_work_order_item_labor FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
    OR mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "bb_wo_status_history_insert"
  ON public.bb_work_order_status_history FOR INSERT TO authenticated
  WITH CHECK (true);
