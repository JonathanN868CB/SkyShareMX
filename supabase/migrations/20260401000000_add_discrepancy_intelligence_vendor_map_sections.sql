-- Add Discrepancy Intelligence and Vendor Map to app_section enum
-- These sections were added to the app but the enum wasn't updated

ALTER TYPE public.app_section ADD VALUE IF NOT EXISTS 'Discrepancy Intelligence';
ALTER TYPE public.app_section ADD VALUE IF NOT EXISTS 'Vendor Map';
