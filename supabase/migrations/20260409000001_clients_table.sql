-- Clients (billing entities tied to aircraft)
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  contact_name text,
  address     text,
  address2    text,
  city        text,
  state       text,
  zip         text,
  country     text,
  phone       text,
  phone2      text,
  email       text,
  taxable     boolean NOT NULL DEFAULT false,
  tax_id      text,
  notes       text,
  inactive    boolean NOT NULL DEFAULT false,
  legacy_id   int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage clients"
  ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link aircraft to clients
ALTER TABLE aircraft ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

COMMENT ON TABLE clients IS 'Billing entities / customers linked to aircraft';
COMMENT ON COLUMN aircraft.client_id IS 'FK to the client billed for work on this aircraft';
