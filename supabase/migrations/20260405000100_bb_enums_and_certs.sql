-- ============================================================
-- BEET BOX — Phase 0a: Shared Enums + Mechanic Certs
-- ============================================================

CREATE TYPE bb_wo_status AS ENUM (
  'draft', 'open', 'waiting_on_parts', 'in_review', 'billing', 'completed', 'void'
);

CREATE TYPE bb_wo_item_status AS ENUM (
  'pending', 'in_progress', 'done', 'needs_review', 'cut_short'
);

CREATE TYPE bb_logbook_section AS ENUM (
  'Airframe', 'Engine 1', 'Engine 2', 'Propeller', 'APU', 'Other'
);

CREATE TYPE bb_priority AS ENUM (
  'routine', 'urgent', 'aog'
);

CREATE TYPE bb_part_condition AS ENUM (
  'new', 'overhauled', 'serviceable', 'as_removed'
);

CREATE TYPE bb_part_transaction_type AS ENUM (
  'receipt', 'issue', 'return', 'adjustment', 'scrap'
);

CREATE TYPE bb_po_status AS ENUM (
  'draft', 'sent', 'partial', 'received', 'closed', 'voided'
);

CREATE TYPE bb_tool_status AS ENUM (
  'active', 'due_soon', 'overdue', 'out_of_service', 'retired'
);

CREATE TYPE bb_invoice_status AS ENUM (
  'draft', 'sent', 'paid', 'void'
);

CREATE TYPE bb_invoice_line_type AS ENUM (
  'part', 'labor', 'misc', 'outside_labor'
);

CREATE TYPE bb_logbook_entry_status AS ENUM (
  'draft', 'signed', 'exported'
);

CREATE TYPE bb_cert_type AS ENUM (
  'A&P', 'IA', 'A&P/IA', 'Avionics', 'Other'
);

CREATE TYPE bb_training_status AS ENUM (
  'current', 'expiring_soon', 'expired', 'not_trained'
);

CREATE TYPE bb_sop_category AS ENUM (
  'Work Orders', 'Parts & Inventory', 'Logbook', 'Invoicing',
  'Tool Calibration', 'Safety', 'Portal Navigation'
);

-- ============================================================
-- bb_mechanic_certs
-- Extends profiles (role = 'Technician') with A&P cert data.
-- ============================================================

CREATE TABLE public.bb_mechanic_certs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cert_type   bb_cert_type NOT NULL,
  cert_number text NOT NULL,
  issued_date date,
  is_primary  boolean NOT NULL DEFAULT false,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_mechanic_certs_profile ON public.bb_mechanic_certs(profile_id);

CREATE OR REPLACE FUNCTION public.bb_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bb_mechanic_certs_updated_at
  BEFORE UPDATE ON public.bb_mechanic_certs
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

ALTER TABLE public.bb_mechanic_certs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_mechanic_certs_select"
  ON public.bb_mechanic_certs FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_mechanic_certs_insert_own"
  ON public.bb_mechanic_certs FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_mechanic_certs_update_own"
  ON public.bb_mechanic_certs FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_mechanic_certs_delete_manager"
  ON public.bb_mechanic_certs FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin')
  );
