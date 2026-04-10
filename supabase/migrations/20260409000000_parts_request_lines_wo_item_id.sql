-- Link parts request lines to specific work order items
ALTER TABLE parts_request_lines
  ADD COLUMN wo_item_id uuid REFERENCES bb_work_order_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN parts_request_lines.wo_item_id IS 'FK to the specific work order item this part was ordered for';
