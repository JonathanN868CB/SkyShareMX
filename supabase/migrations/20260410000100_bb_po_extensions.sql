-- ============================================================
-- BEET BOX — PO Extensions
-- Adds: line_status enum, new columns on existing PO tables,
--       purchase_order_id on bb_receiving_records,
--       bb_po_invoices, bb_po_activity
-- Note: catalog_id, parts_request_line_id, vendor_id already
--       existed from prior ad-hoc migrations.
-- ============================================================

-- ─── 1. New enum ────────────────────────────────────────────────────────────
CREATE TYPE bb_po_line_status AS ENUM (
  'pending', 'shipped', 'backordered', 'received', 'cancelled'
);

-- ─── 2. New columns on bb_purchase_order_lines ──────────────────────────────
ALTER TABLE public.bb_purchase_order_lines
  ADD COLUMN line_status              bb_po_line_status NOT NULL DEFAULT 'pending',
  ADD COLUMN vendor_part_number       text,
  ADD COLUMN line_notes               text,
  ADD COLUMN line_expected_delivery   date;

CREATE INDEX idx_bb_po_lines_catalog  ON public.bb_purchase_order_lines(catalog_id);
CREATE INDEX idx_bb_po_lines_req_line ON public.bb_purchase_order_lines(parts_request_line_id);

-- ─── 3. New columns on bb_purchase_orders ───────────────────────────────────
ALTER TABLE public.bb_purchase_orders
  ADD COLUMN carrier             text,
  ADD COLUMN tracking_number     text,
  ADD COLUMN tracking_status     text,
  ADD COLUMN tracking_updated_at timestamptz;

CREATE INDEX idx_bb_po_vendor ON public.bb_purchase_orders(vendor_id);

-- ─── 4. Add purchase_order_id to existing bb_receiving_records ──────────────
ALTER TABLE public.bb_receiving_records
  ADD COLUMN purchase_order_id uuid REFERENCES public.bb_purchase_orders(id) ON DELETE CASCADE;

CREATE INDEX idx_bb_recv_po   ON public.bb_receiving_records(purchase_order_id);
CREATE INDEX idx_bb_recv_line ON public.bb_receiving_records(po_line_id);
CREATE INDEX idx_bb_recv_date ON public.bb_receiving_records(received_at DESC);

-- ─── 5. bb_po_invoices ──────────────────────────────────────────────────────
-- Vendor invoice leg of the three-way match (PO + receipt + invoice).
-- Multiple invoices per PO are allowed.
CREATE TABLE public.bb_po_invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL REFERENCES public.bb_purchase_orders(id) ON DELETE CASCADE,
  invoice_number     text NOT NULL,
  invoice_date       date,
  amount             numeric(10,2) NOT NULL,
  match_status       text NOT NULL DEFAULT 'pending',  -- 'matched'|'over'|'under'|'pending'
  notes              text,
  recorded_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_po_inv_po ON public.bb_po_invoices(purchase_order_id);

CREATE TRIGGER trg_bb_po_invoices_updated_at
  BEFORE UPDATE ON public.bb_po_invoices
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

ALTER TABLE public.bb_po_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_po_inv_select" ON public.bb_po_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_po_inv_insert"
  ON public.bb_po_invoices FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_po_inv_update"
  ON public.bb_po_invoices FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_po_inv_delete"
  ON public.bb_po_invoices FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

-- ─── 6. bb_po_activity ──────────────────────────────────────────────────────
-- Persistent activity log for purchase orders.
CREATE TABLE public.bb_po_activity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.bb_purchase_orders(id) ON DELETE CASCADE,
  type              text NOT NULL DEFAULT 'note',
  -- 'note'|'status_change'|'email'|'phone'|'system'|'receive'|'invoice'
  author_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name       text NOT NULL,
  message           text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_po_act_po   ON public.bb_po_activity(purchase_order_id);
CREATE INDEX idx_bb_po_act_date ON public.bb_po_activity(created_at DESC);

ALTER TABLE public.bb_po_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_po_act_select" ON public.bb_po_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_po_act_insert"
  ON public.bb_po_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "bb_po_act_delete"
  ON public.bb_po_activity FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
