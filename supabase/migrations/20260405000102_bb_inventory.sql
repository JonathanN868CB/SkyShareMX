-- ============================================================
-- BEET BOX — Phase 0c: Inventory (2 tables)
-- ============================================================

CREATE TABLE public.bb_inventory_parts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number   text NOT NULL UNIQUE,
  description   text NOT NULL DEFAULT '',
  manufacturer  text,
  uom           text NOT NULL DEFAULT 'EA',
  qty_on_hand   integer NOT NULL DEFAULT 0,
  qty_reserved  integer NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 0,
  unit_cost     numeric(10,2) NOT NULL DEFAULT 0,
  location_bin  text,
  condition     bb_part_condition NOT NULL DEFAULT 'new',
  vendor_name   text,
  is_consumable boolean NOT NULL DEFAULT false,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_inventory_part_number ON public.bb_inventory_parts(part_number);
CREATE INDEX idx_bb_inventory_qty         ON public.bb_inventory_parts(qty_on_hand);

CREATE TRIGGER trg_bb_inventory_updated_at
  BEFORE UPDATE ON public.bb_inventory_parts
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

CREATE TABLE public.bb_part_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id          uuid NOT NULL REFERENCES public.bb_inventory_parts(id) ON DELETE CASCADE,
  type             bb_part_transaction_type NOT NULL,
  qty              integer NOT NULL,
  unit_cost        numeric(10,2),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  performed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  performed_name   text NOT NULL DEFAULT '',
  wo_ref           text,
  po_ref           text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_part_transactions_part ON public.bb_part_transactions(part_id);
CREATE INDEX idx_bb_part_transactions_date ON public.bb_part_transactions(transaction_date DESC);
CREATE INDEX idx_bb_part_transactions_type ON public.bb_part_transactions(type);

ALTER TABLE public.bb_inventory_parts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_part_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_inventory_select" ON public.bb_inventory_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_inventory_insert"
  ON public.bb_inventory_parts FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_inventory_update"
  ON public.bb_inventory_parts FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_inventory_delete"
  ON public.bb_inventory_parts FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_part_transactions_select" ON public.bb_part_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_part_transactions_insert"
  ON public.bb_part_transactions FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Technician', 'Manager', 'Admin', 'Super Admin'));
