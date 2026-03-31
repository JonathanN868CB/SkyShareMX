-- ── Career badge catalog ──────────────────────────────────────────────────────
CREATE TABLE mxlms.career_badges (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       text NOT NULL,
  short_code  text,
  description text,
  color       text NOT NULL DEFAULT '#475569',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ── Per-tech role history ─────────────────────────────────────────────────────
CREATE TABLE mxlms.technician_career_history (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  technician_id  bigint NOT NULL REFERENCES mxlms.technicians(id) ON DELETE CASCADE,
  badge_id       bigint NOT NULL REFERENCES mxlms.career_badges(id),
  from_date      text,
  to_date        text,
  notes          text,
  display_order  integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX technician_career_history_tech_id_idx
  ON mxlms.technician_career_history(technician_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE mxlms.career_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mxlms.technician_career_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_badges_read_all" ON mxlms.career_badges
  FOR SELECT USING (true);

CREATE POLICY "career_history_read" ON mxlms.technician_career_history
  FOR SELECT USING (
    technician_id = mxlms.my_tech_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND role IN ('Manager'::public.app_role, 'Admin'::public.app_role, 'Super Admin'::public.app_role)
    )
  );

-- ── Badge catalog seed ────────────────────────────────────────────────────────
INSERT INTO mxlms.career_badges (title, short_code, description, color) VALUES
  ('Technician',                  'AMT',     'Aviation Maintenance Technician',              '#3b82f6'),
  ('Base Manager — OGD',          'OGD',     'Base Manager, Ogden Station',                  '#f59e0b'),
  ('Dual Base Manager — OGD/SLC', 'OGD/SLC', 'Dual Base Manager, Ogden & Salt Lake City',    '#d4a017');

-- ── Richard Paden (id=8) career history ──────────────────────────────────────
INSERT INTO mxlms.technician_career_history
  (technician_id, badge_id, from_date, to_date, display_order)
VALUES
  (8, (SELECT id FROM mxlms.career_badges WHERE short_code = 'AMT'),     '2022-10-24', null, 1),
  (8, (SELECT id FROM mxlms.career_badges WHERE short_code = 'OGD'),     null,         null, 2),
  (8, (SELECT id FROM mxlms.career_badges WHERE short_code = 'OGD/SLC'), null,         null, 3);
