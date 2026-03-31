CREATE TABLE vendor_contacts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id   uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name        text NOT NULL,
  title       text,
  role        text,
  phone       text,
  mobile      text,
  email       text,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX vendor_contacts_vendor_id_idx ON vendor_contacts(vendor_id);
