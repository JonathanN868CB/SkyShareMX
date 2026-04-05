-- ─── Records Vault Phase 2 — Maintenance Intelligence Layer ──────────────────
--
-- Adds:
--   rv_maintenance_events  — one row per extracted maintenance event (Claude)
--   rv_components          — part installation/removal history
--   extraction_status cols on rv_record_sources
--   rv_get_timeline()      — paginated, filtered timeline RPC
--   rv_search_events()     — full-text search over event descriptions
--   RLS for both new tables

-- ─── 1. Extraction status columns on rv_record_sources ────────────────────────

ALTER TABLE rv_record_sources
  ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending','extracting','complete','failed')),
  ADD COLUMN IF NOT EXISTS extraction_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS events_extracted INTEGER DEFAULT 0;

-- ─── 2. rv_maintenance_events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rv_maintenance_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id          UUID        NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  record_source_id     UUID        NOT NULL REFERENCES rv_record_sources(id) ON DELETE CASCADE,
  page_ids             UUID[]      NOT NULL DEFAULT '{}',
  -- Classification
  event_type           TEXT        NOT NULL CHECK (event_type IN (
                          'logbook_entry','inspection','ad_compliance','sb_compliance',
                          'component_install','component_removal','repair','alteration',
                          'overhaul','return_to_service','discrepancy','other'
                        )),
  -- When & where
  event_date           DATE,
  station              TEXT,
  -- Aircraft state at time of event
  aircraft_total_time  NUMERIC(8,1),
  aircraft_cycles      INTEGER,
  -- What happened
  description          TEXT        NOT NULL,
  -- Part/component references
  part_numbers         TEXT[]      NOT NULL DEFAULT '{}',
  serial_numbers       TEXT[]      NOT NULL DEFAULT '{}',
  -- Document references
  work_order_number    TEXT,
  ad_sb_number         TEXT,
  -- Personnel
  performed_by         TEXT,
  approved_by          TEXT,
  -- Extraction metadata
  confidence           NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  extraction_model     TEXT        DEFAULT 'claude-haiku-4-5-20251001',
  extraction_notes     TEXT,
  -- Search
  search_vector        TSVECTOR,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep search_vector current
CREATE OR REPLACE FUNCTION update_rv_event_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.description,      '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.ad_sb_number,     '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.work_order_number,'')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.part_numbers,  ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.serial_numbers,' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.performed_by,     '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.approved_by,      '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rv_event_search_trigger
  BEFORE INSERT OR UPDATE OF description, ad_sb_number, work_order_number,
                              part_numbers, serial_numbers, performed_by, approved_by
  ON rv_maintenance_events
  FOR EACH ROW EXECUTE FUNCTION update_rv_event_search_vector();

-- Indexes
CREATE INDEX IF NOT EXISTS rv_events_aircraft_idx    ON rv_maintenance_events(aircraft_id);
CREATE INDEX IF NOT EXISTS rv_events_source_idx      ON rv_maintenance_events(record_source_id);
CREATE INDEX IF NOT EXISTS rv_events_date_idx        ON rv_maintenance_events(event_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS rv_events_type_idx        ON rv_maintenance_events(event_type);
CREATE INDEX IF NOT EXISTS rv_events_search_idx      ON rv_maintenance_events USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS rv_events_pns_idx         ON rv_maintenance_events USING GIN(part_numbers);
CREATE INDEX IF NOT EXISTS rv_events_sns_idx         ON rv_maintenance_events USING GIN(serial_numbers);

-- ─── 3. rv_components — part installation / removal history ───────────────────

CREATE TABLE IF NOT EXISTS rv_components (
  id                    UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id           UUID       NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  part_number           TEXT       NOT NULL,
  serial_number         TEXT,
  description           TEXT,
  -- Install event
  installed_event_id    UUID       REFERENCES rv_maintenance_events(id) ON DELETE SET NULL,
  installed_date        DATE,
  installed_hours       NUMERIC(8,1),
  -- Removal event (NULL = still installed)
  removed_event_id      UUID       REFERENCES rv_maintenance_events(id) ON DELETE SET NULL,
  removed_date          DATE,
  removed_hours         NUMERIC(8,1),
  -- Computed time-in-service
  time_installed        NUMERIC(8,1) GENERATED ALWAYS AS (
    CASE
      WHEN removed_hours IS NOT NULL AND installed_hours IS NOT NULL
        AND removed_hours >= installed_hours
      THEN removed_hours - installed_hours
      ELSE NULL
    END
  ) STORED,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rv_components_aircraft_idx ON rv_components(aircraft_id);
CREATE INDEX IF NOT EXISTS rv_components_pn_idx       ON rv_components(part_number);
CREATE INDEX IF NOT EXISTS rv_components_sn_idx       ON rv_components(serial_number);

-- ─── 4. rv_get_timeline — paginated timeline RPC ─────────────────────────────

CREATE OR REPLACE FUNCTION rv_get_timeline(
  p_aircraft_id   UUID,
  p_event_type    TEXT     DEFAULT NULL,
  p_date_from     DATE     DEFAULT NULL,
  p_date_to       DATE     DEFAULT NULL,
  p_query         TEXT     DEFAULT NULL,
  p_limit         INT      DEFAULT 50,
  p_offset        INT      DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  event_type          TEXT,
  event_date          DATE,
  aircraft_total_time NUMERIC,
  description         TEXT,
  part_numbers        TEXT[],
  serial_numbers      TEXT[],
  work_order_number   TEXT,
  ad_sb_number        TEXT,
  performed_by        TEXT,
  approved_by         TEXT,
  station             TEXT,
  confidence          NUMERIC,
  record_source_id    UUID,
  original_filename   TEXT,
  source_category     TEXT,
  page_ids            UUID[],
  total_count         BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    e.id,
    e.event_type,
    e.event_date,
    e.aircraft_total_time,
    e.description,
    e.part_numbers,
    e.serial_numbers,
    e.work_order_number,
    e.ad_sb_number,
    e.performed_by,
    e.approved_by,
    e.station,
    e.confidence,
    e.record_source_id,
    rs.original_filename,
    rs.source_category,
    e.page_ids,
    COUNT(*) OVER() AS total_count
  FROM rv_maintenance_events e
  JOIN rv_record_sources rs ON rs.id = e.record_source_id
  WHERE
    e.aircraft_id = p_aircraft_id
    AND (p_event_type IS NULL OR e.event_type = p_event_type)
    AND (p_date_from  IS NULL OR e.event_date >= p_date_from)
    AND (p_date_to    IS NULL OR e.event_date <= p_date_to)
    AND (
      p_query IS NULL
      OR e.search_vector @@ websearch_to_tsquery('english', p_query)
    )
  ORDER BY e.event_date DESC NULLS LAST, e.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─── 5. rv_search_events — cross-aircraft event search ───────────────────────

CREATE OR REPLACE FUNCTION rv_search_events(
  p_query       TEXT,
  p_aircraft_id UUID    DEFAULT NULL,
  p_event_type  TEXT    DEFAULT NULL,
  p_limit       INT     DEFAULT 50,
  p_offset      INT     DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  aircraft_id         UUID,
  event_type          TEXT,
  event_date          DATE,
  aircraft_total_time NUMERIC,
  description         TEXT,
  part_numbers        TEXT[],
  serial_numbers      TEXT[],
  ad_sb_number        TEXT,
  work_order_number   TEXT,
  confidence          NUMERIC,
  record_source_id    UUID,
  original_filename   TEXT,
  page_ids            UUID[],
  rank                FLOAT4
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    e.id,
    e.aircraft_id,
    e.event_type,
    e.event_date,
    e.aircraft_total_time,
    e.description,
    e.part_numbers,
    e.serial_numbers,
    e.ad_sb_number,
    e.work_order_number,
    e.confidence,
    e.record_source_id,
    rs.original_filename,
    e.page_ids,
    ts_rank(e.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM rv_maintenance_events e
  JOIN rv_record_sources rs ON rs.id = e.record_source_id
  WHERE
    e.search_vector @@ websearch_to_tsquery('english', p_query)
    AND (p_aircraft_id IS NULL OR e.aircraft_id = p_aircraft_id)
    AND (p_event_type  IS NULL OR e.event_type  = p_event_type)
  ORDER BY rank DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE rv_maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rv_components         ENABLE ROW LEVEL SECURITY;

-- rv_maintenance_events — read for Records Vault, write via service role only
CREATE POLICY "rv_events_select" ON rv_maintenance_events
  FOR SELECT USING (has_permission(auth.uid(), 'Records Vault'));

CREATE POLICY "rv_events_service_insert" ON rv_maintenance_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rv_events_service_update" ON rv_maintenance_events
  FOR UPDATE USING (auth.role() = 'service_role');

-- rv_components — same pattern
CREATE POLICY "rv_components_select" ON rv_components
  FOR SELECT USING (has_permission(auth.uid(), 'Records Vault'));

CREATE POLICY "rv_components_service_insert" ON rv_components
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rv_components_service_update" ON rv_components
  FOR UPDATE USING (auth.role() = 'service_role');
