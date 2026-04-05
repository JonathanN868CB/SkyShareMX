-- ============================================================
-- BEET BOX — Phase 0h: SOPs + Training (4 tables)
-- ============================================================

CREATE TABLE public.bb_sops (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_number     text NOT NULL UNIQUE,
  title          text NOT NULL,
  category       bb_sop_category NOT NULL,
  revision       text NOT NULL DEFAULT 'A',
  effective_date date,
  review_date    date,
  author         text,
  approved_by    text,
  description    text NOT NULL DEFAULT '',
  tags           text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_sops_category ON public.bb_sops(category);

CREATE TRIGGER trg_bb_sops_updated_at
  BEFORE UPDATE ON public.bb_sops
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

CREATE TABLE public.bb_sop_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id      uuid NOT NULL REFERENCES public.bb_sops(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  instruction text NOT NULL DEFAULT '',
  note        text,
  warning     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, step_number)
);

CREATE INDEX idx_bb_sop_steps_sop ON public.bb_sop_steps(sop_id);

CREATE TABLE public.bb_sop_related (
  sop_id         uuid NOT NULL REFERENCES public.bb_sops(id) ON DELETE CASCADE,
  related_sop_id uuid NOT NULL REFERENCES public.bb_sops(id) ON DELETE CASCADE,
  PRIMARY KEY (sop_id, related_sop_id),
  CHECK (sop_id <> related_sop_id)
);

CREATE TABLE public.bb_training_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_type      text NOT NULL,
  issued_date        date NOT NULL,
  expiry_date        date,
  issuer             text NOT NULL DEFAULT '',
  certificate_number text,
  status             bb_training_status NOT NULL DEFAULT 'current',
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bb_training_mechanic ON public.bb_training_records(mechanic_id);
CREATE INDEX idx_bb_training_status   ON public.bb_training_records(status);
CREATE INDEX idx_bb_training_expiry   ON public.bb_training_records(expiry_date);

CREATE TRIGGER trg_bb_training_updated_at
  BEFORE UPDATE ON public.bb_training_records
  FOR EACH ROW EXECUTE FUNCTION public.bb_set_updated_at();

ALTER TABLE public.bb_sops             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_sop_steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_sop_related      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bb_training_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_sops_select"        ON public.bb_sops        FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_sop_steps_select"   ON public.bb_sop_steps   FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_sop_related_select" ON public.bb_sop_related FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_sops_insert"
  ON public.bb_sops FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_sops_update"
  ON public.bb_sops FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_sops_delete"
  ON public.bb_sops FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_sop_steps_insert"
  ON public.bb_sop_steps FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_sop_steps_update"
  ON public.bb_sop_steps FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_sop_steps_delete"
  ON public.bb_sop_steps FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_sop_related_insert"
  ON public.bb_sop_related FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_sop_related_delete"
  ON public.bb_sop_related FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));

CREATE POLICY "bb_training_select" ON public.bb_training_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "bb_training_insert"
  ON public.bb_training_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_training_update"
  ON public.bb_training_records FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
CREATE POLICY "bb_training_delete"
  ON public.bb_training_records FOR DELETE TO authenticated
  USING ((SELECT role FROM public.profiles WHERE user_id = auth.uid()) IN ('Manager', 'Admin', 'Super Admin'));
