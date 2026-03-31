-- Add Compliance and Safety to the app_section enum
ALTER TYPE public.app_section ADD VALUE IF NOT EXISTS 'Compliance';
ALTER TYPE public.app_section ADD VALUE IF NOT EXISTS 'Safety';
