-- ============================================================
-- BEET BOX — Phase 0f: Invoicing (2 tables)
-- ============================================================

CREATE TABLE public.bb_invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number     text NOT NULL UNIQUE,
  work_order_id      uuid REFERENCES public.bb_work_orders(id) ON DELETE SET NULL,
  wo_number          text,
  aircraft_id        uuid REFERENCES public.aircraft(id) ON DELETE RESTRICT,
  guest_registration text,
  customer_name      text NOT NULL DEFAULT '',
  status             bb_invoice_status NOT NULL DEFAULT 'draft',
  issued_date        date NOT NULL DEFAULT CURRENT_DATE,
  due_date           date,
  paid_at            timestamptz,
  subtotal_labor     numeric(12,2) NOT NULL DEFAULT 0,
  subtotal_parts     numeric(12,2) NOT NULL DEFAULT 0,
  subtotal_misc      numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate           numeric(5,4) NOT NULL DEFAULT 0,
  tax_amount         numeric(12,2) NOT NULL DEFAULT 0,
  grand_total        numeric(12,2) NOT NULL DEFAULT 0,
  notes              text,
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_invoices_status   ON public.bb_invoices(status);
CREATE INDEX idx_bb_invoices_aircraft ON public.bb_invoices(aircraft_id);
CREATE INDEX idx_bb_invoices_issued   ON public.bb_invoices(issued_date DESC);
CREATE INDEX idx_bb_invoices_wo       ON public.bb_invoices(work_order_id);

CREATE TRIGGER trg_bb_invoices_updated_at
  BEFORE UPDATE ON public.bb_invoices
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

CREATE TABLE public.bb_invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.bb_invoices(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  description text NOT NULL DEFAULT '',
  type        bb_invoice_line_type NOT NULL DEFAULT 'misc',
  qty         numeric(8,2) NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  extended    numeric(12,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
  taxable     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, line_number)
);

CREATE INDEX idx_bb_invoice_lines_invoice ON public.bb_invoice_lines(invoice_id);

ALTER TABLE public.bb_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_invoices_select" ON public.bb_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_invoices_insert"
  ON public.bb_invoices FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_invoices_update"
  ON public.bb_invoices FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_invoices_delete"
  ON public.bb_invoices FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_invoice_lines_select" ON public.bb_invoice_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_invoice_lines_insert"
  ON public.bb_invoice_lines FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_invoice_lines_update"
  ON public.bb_invoice_lines FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_invoice_lines_delete"
  ON public.bb_invoice_lines FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
