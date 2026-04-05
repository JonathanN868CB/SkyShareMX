-- ============================================================
-- BEET BOX — Phase 0h: Logbook signatories (group logbook entries)
-- One entry per logbook section per WO; multiple mechanics can
-- sign the same page, each with their own cert info + lines.
-- ============================================================

-- ── 1. Signatories table ────────────────────────────────────────────────────────
CREATE TABLE public.bb_logbook_entry_signatories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid NOT NULL REFERENCES public.bb_logbook_entries(id) ON DELETE CASCADE,
  profile_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mechanic_name text NOT NULL,
  cert_type     bb_cert_type,
  cert_number   text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- One signatory record per profile per entry
  UNIQUE (entry_id, profile_id)
);

CREATE INDEX idx_bb_logbook_signatories_entry ON public.bb_logbook_entry_signatories(entry_id);

-- ── 2. Add signatory + WO item link to entry lines ──────────────────────────────
ALTER TABLE public.bb_logbook_entry_lines
  ADD COLUMN IF NOT EXISTS signatory_id uuid REFERENCES public.bb_logbook_entry_signatories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wo_item_id   uuid REFERENCES public.bb_work_order_items(id) ON DELETE SET NULL;

-- ── 3. RLS on signatories ───────────────────────────────────────────────────────
ALTER TABLE public.bb_logbook_entry_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bb_logbook_signatories_select"
  ON public.bb_logbook_entry_signatories FOR SELECT TO authenticated USING (true);

CREATE POLICY "bb_logbook_signatories_insert"
  ON public.bb_logbook_entry_signatories FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Technician', 'Manager', 'Admin', 'Super Admin')
    AND EXISTS (
      SELECT 1 FROM public.bb_logbook_entries e
      WHERE e.id = entry_id AND e.status = 'draft'
    )
  );

CREATE POLICY "bb_logbook_signatories_update"
  ON public.bb_logbook_entry_signatories FOR UPDATE TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
  );

CREATE POLICY "bb_logbook_signatories_delete"
  ON public.bb_logbook_entry_signatories FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid())
      IN ('Manager', 'Admin', 'Super Admin')
  );

-- ── 4. Broaden entry + line policies to include signatories ────────────────────
-- A mechanic who is a signatory on the entry can update the entry and its lines.

DROP POLICY IF EXISTS "bb_logbook_entries_update" ON public.bb_logbook_entries;
CREATE POLICY "bb_logbook_entries_update"
  ON public.bb_logbook_entries FOR UPDATE TO authenticated
  USING (
    status = 'draft'
    AND (
      mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.bb_logbook_entry_signatories s
        WHERE s.entry_id = id
          AND s.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
      OR (SELECT role FROM public.profiles WHERE user_id = auth.uid())
        IN ('Manager', 'Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "bb_logbook_lines_insert" ON public.bb_logbook_entry_lines;
CREATE POLICY "bb_logbook_lines_insert"
  ON public.bb_logbook_entry_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bb_logbook_entries e
      WHERE e.id = entry_id AND e.status = 'draft'
        AND (
          e.mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.bb_logbook_entry_signatories s
            WHERE s.entry_id = e.id
              AND s.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          )
          OR (SELECT role FROM public.profiles WHERE user_id = auth.uid())
            IN ('Manager', 'Admin', 'Super Admin')
        )
    )
  );

DROP POLICY IF EXISTS "bb_logbook_lines_update" ON public.bb_logbook_entry_lines;
CREATE POLICY "bb_logbook_lines_update"
  ON public.bb_logbook_entry_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bb_logbook_entries e
      WHERE e.id = entry_id AND e.status = 'draft'
        AND (
          e.mechanic_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.bb_logbook_entry_signatories s
            WHERE s.entry_id = e.id
              AND s.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          )
          OR (SELECT role FROM public.profiles WHERE user_id = auth.uid())
            IN ('Manager', 'Admin', 'Super Admin')
        )
    )
  );
