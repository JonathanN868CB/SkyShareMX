-- ============================================================================
-- Parts Module — Schema
-- Replaces Google Form + Google Sheet parts ordering workflow
-- ============================================================================

-- 1. Add "Parts" to the app_section enum
ALTER TYPE app_section ADD VALUE IF NOT EXISTS 'Parts';

-- 2. parts_requests — one row per submission
CREATE TABLE parts_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_type    text NOT NULL DEFAULT 'aircraft'
                CHECK (order_type IN ('aircraft', 'stock')),

  -- Aircraft order fields
  aircraft_id   uuid REFERENCES aircraft(id),
  aircraft_tail text,
  job_description text NOT NULL,
  work_order    text,
  item_number   text,

  -- Stock order fields
  stock_purpose text,

  -- Logistics
  date_needed   date NOT NULL,
  ship_to       text NOT NULL,
  ship_to_address text,
  all_at_once   boolean NOT NULL DEFAULT false,
  delay_affects_rts boolean NOT NULL DEFAULT false,

  -- AOG
  aog           boolean NOT NULL DEFAULT false,
  aog_removed_pn text,
  aog_removed_sn text,
  aog_squawk    text,

  -- Notes
  notes         text,

  -- Lifecycle
  status        text NOT NULL DEFAULT 'requested'
                CHECK (status IN (
                  'requested', 'pending_approval', 'approved', 'denied',
                  'sourcing', 'ordered', 'shipped', 'received', 'closed'
                )),
  requested_by  uuid NOT NULL REFERENCES profiles(id),

  -- EBIS reference (future)
  ebis_work_order_id text,
  ebis_service_request_id text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. parts_request_lines — one row per part within a request
CREATE TABLE parts_request_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES parts_requests(id) ON DELETE CASCADE,
  line_number   int NOT NULL,

  -- Submitted by mechanic
  part_number   text NOT NULL,
  alternate_pn  text,
  description   text,
  quantity      int NOT NULL CHECK (quantity >= 1),
  condition     text NOT NULL DEFAULT 'new_overhaul'
                CHECK (condition IN ('new_overhaul', 'any', 'new_overhaul_with_times')),

  -- Enriched by parts manager
  vendor        text,
  po_number     text,
  unit_cost     numeric(12,2),
  tracking_number text,
  tracking_status text,
  tracking_eta  date,
  tracking_events jsonb,
  tracking_last_checked timestamptz,

  -- Exchange / core return
  is_exchange   boolean NOT NULL DEFAULT false,
  core_due_by   date,
  core_tracking text,
  core_status   text CHECK (core_status IS NULL OR core_status IN (
    'pending', 'paperwork_complete', 'shipped', 'vendor_received', 'closed'
  )),

  -- Per-line status (lines can progress independently)
  line_status   text NOT NULL DEFAULT 'requested'
                CHECK (line_status IN (
                  'requested', 'sourcing', 'ordered', 'shipped', 'received', 'closed'
                )),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (request_id, line_number)
);

-- 4. parts_approvals — audit trail for approval decisions
CREATE TABLE parts_approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES parts_requests(id) ON DELETE CASCADE,
  approver_id   uuid NOT NULL REFERENCES profiles(id),
  decision      text NOT NULL CHECK (decision IN ('approved', 'denied')),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 5. parts_notes — activity thread per request
CREATE TABLE parts_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES parts_requests(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL REFERENCES profiles(id),
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 6. parts_status_history — every status change logged
CREATE TABLE parts_status_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES parts_requests(id) ON DELETE CASCADE,
  line_id       uuid REFERENCES parts_request_lines(id) ON DELETE CASCADE,
  old_status    text,
  new_status    text NOT NULL,
  changed_by    uuid NOT NULL REFERENCES profiles(id),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 7. parts_config — approval thresholds, ship-to addresses, settings
CREATE TABLE parts_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  value         jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_parts_requests_status ON parts_requests(status);
CREATE INDEX idx_parts_requests_aircraft ON parts_requests(aircraft_tail);
CREATE INDEX idx_parts_requests_requested_by ON parts_requests(requested_by);
CREATE INDEX idx_parts_requests_aog ON parts_requests(aog) WHERE aog = true;
CREATE INDEX idx_parts_requests_date_needed ON parts_requests(date_needed);
CREATE INDEX idx_parts_request_lines_request ON parts_request_lines(request_id);
CREATE INDEX idx_parts_request_lines_status ON parts_request_lines(line_status);
CREATE INDEX idx_parts_request_lines_pn ON parts_request_lines(part_number);
CREATE INDEX idx_parts_notes_request ON parts_notes(request_id);
CREATE INDEX idx_parts_status_history_request ON parts_status_history(request_id);
CREATE INDEX idx_parts_approvals_request ON parts_approvals(request_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all parts data (visibility is a feature)
CREATE POLICY "Authenticated users can read parts_requests"
  ON parts_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read parts_request_lines"
  ON parts_request_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read parts_approvals"
  ON parts_approvals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read parts_notes"
  ON parts_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read parts_status_history"
  ON parts_status_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read parts_config"
  ON parts_config FOR SELECT TO authenticated USING (true);

-- Any authenticated user can submit a parts request
CREATE POLICY "Authenticated users can insert parts_requests"
  ON parts_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can insert parts_request_lines"
  ON parts_request_lines FOR INSERT TO authenticated
  WITH CHECK (true);

-- Any authenticated user can add notes
CREATE POLICY "Authenticated users can insert parts_notes"
  ON parts_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Updates restricted to Admins, Super Admins, and Managers (parts manager, shop manager)
CREATE POLICY "Managers and admins can update parts_requests"
  ON parts_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin', 'Manager')
    )
  );

CREATE POLICY "Managers and admins can update parts_request_lines"
  ON parts_request_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin', 'Manager')
    )
  );

-- Approvals can be inserted by Managers and above
CREATE POLICY "Managers and admins can insert parts_approvals"
  ON parts_approvals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin', 'Manager')
    )
  );

-- Status history inserted by system on any status change
CREATE POLICY "Authenticated users can insert parts_status_history"
  ON parts_status_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- Config editable by admins only
CREATE POLICY "Admins can update parts_config"
  ON parts_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin')
    )
  );

CREATE POLICY "Admins can insert parts_config"
  ON parts_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin')
    )
  );

-- ============================================================================
-- Seed config
-- ============================================================================

INSERT INTO parts_config (key, value) VALUES
  ('ship_to_addresses', '[
    {"label": "OGD Hangar", "address": "3909 Airport Rd, Ogden, UT 84405"},
    {"label": "SLC Base", "address": "365 N 2370 W, Salt Lake City, UT 84116"},
    {"label": "MZJ Hangar", "address": "2850 S Marana Center Blvd, Marana, AZ 85658"}
  ]'::jsonb),
  ('approval_rules', '{
    "enabled": false,
    "require_approval_roles": ["Technician"],
    "approver_chain": ["Manager", "Admin"],
    "notes": "When enabled, requests from listed roles require approval before sourcing"
  }'::jsonb);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_parts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parts_requests_updated_at
  BEFORE UPDATE ON parts_requests
  FOR EACH ROW EXECUTE FUNCTION update_parts_updated_at();

CREATE TRIGGER trg_parts_request_lines_updated_at
  BEFORE UPDATE ON parts_request_lines
  FOR EACH ROW EXECUTE FUNCTION update_parts_updated_at();

CREATE TRIGGER trg_parts_config_updated_at
  BEFORE UPDATE ON parts_config
  FOR EACH ROW EXECUTE FUNCTION update_parts_updated_at();
