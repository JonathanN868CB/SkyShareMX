-- webhook_inbound — inbound webhook receiver tables
-- Receives maintenance schedule events from external scheduling software (e.g. Avianis)

-- Raw inbound request log (one row per webhook call)
CREATE TABLE webhook_inbound_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL DEFAULT 'jetinsight_napster',
  received_at     timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'received', -- received | processed | failed
  raw_payload     jsonb NOT NULL,
  event_count     int,
  inserted_count  int,
  skipped_count   int,
  error_detail    text
);

-- Parsed maintenance schedule events (one row per calendar event)
CREATE TABLE scheduled_maintenance_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_uuid    uuid NOT NULL UNIQUE,  -- extendedProps.uuid from scheduling software (dedup key)
  aircraft_tail    text NOT NULL,          -- extendedProps.aircraft
  title            text NOT NULL,
  start_at         timestamptz NOT NULL,
  end_at           timestamptz NOT NULL,
  notes            text,
  created_by_user  text,
  event_type       text NOT NULL DEFAULT 'Maintenance',
  raw_event        jsonb NOT NULL,         -- full original event for future re-parsing
  received_at      timestamptz NOT NULL DEFAULT now(),
  webhook_log_id   uuid REFERENCES webhook_inbound_log(id)
);

CREATE INDEX idx_sme_aircraft_tail ON scheduled_maintenance_events(aircraft_tail);
CREATE INDEX idx_sme_start_at ON scheduled_maintenance_events(start_at);
CREATE INDEX idx_sme_external_uuid ON scheduled_maintenance_events(external_uuid);

ALTER TABLE scheduled_maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_inbound_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scheduled_maintenance_events"
  ON scheduled_maintenance_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read webhook_inbound_log"
  ON webhook_inbound_log FOR SELECT TO authenticated USING (true);
