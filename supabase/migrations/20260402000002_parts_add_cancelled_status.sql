-- Add 'cancelled' to the parts_requests status check constraint
ALTER TABLE parts_requests
  DROP CONSTRAINT IF EXISTS parts_requests_status_check;

ALTER TABLE parts_requests
  ADD CONSTRAINT parts_requests_status_check
  CHECK (status IN (
    'requested', 'pending_approval', 'approved', 'denied',
    'sourcing', 'ordered', 'shipped', 'received', 'closed',
    'cancelled'
  ));
