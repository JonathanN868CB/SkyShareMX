-- ============================================================
-- BEET BOX — Phase 0d: Purchase Orders (2 tables)
-- ============================================================

CREATE TABLE public.bb_purchase_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number         text NOT NULL UNIQUE,
  vendor_name       text NOT NULL,
  vendor_contact    text,
  status            bb_po_status NOT NULL DEFAULT 'draft',
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expected_delivery date,
  received_at       timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_po_status     ON public.bb_purchase_orders(status);
CREATE INDEX idx_bb_po_created_at ON public.bb_purchase_orders(created_at DESC);

CREATE TRIGGER trg_bb_po_updated_at
  BEFORE UPDATE ON public.bb_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

CREATE TABLE public.bb_purchase_order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.bb_purchase_orders(id) ON DELETE CASCADE,
  line_number       integer NOT NULL,
  part_number       text NOT NULL,
  description       text NOT NULL DEFAULT '',
  qty_ordered       integer NOT NULL DEFAULT 1,
  qty_received      integer NOT NULL DEFAULT 0,
  unit_cost         numeric(10,2) NOT NULL DEFAULT 0,
  wo_ref            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, line_number)
);

CREATE INDEX idx_bb_po_lines_po ON public.bb_purchase_order_lines(purchase_order_id);

CREATE TRIGGER trg_bb_po_lines_updated_at
  BEFORE UPDATE ON public.bb_purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

ALTER TABLE public.bb_purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_po_select" ON public.bb_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_po_insert"
  ON public.bb_purchase_orders FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_po_update"
  ON public.bb_purchase_orders FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_po_delete"
  ON public.bb_purchase_orders FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_po_lines_select" ON public.bb_purchase_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_po_lines_insert"
  ON public.bb_purchase_order_lines FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_po_lines_update"
  ON public.bb_purchase_order_lines FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Technician', 'Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_po_lines_delete"
  ON public.bb_purchase_order_lines FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
