-- Fix mm_aircraft_documents CHECK constraints to match UI constants
-- Database had: airframe, engine, prop, apu (and awl, sched_mx)
-- UI expects: airframe, engine, apu, propeller (and awl, sched_mx)

-- Drop old constraints first so we can update the data
ALTER TABLE public.mm_aircraft_documents
DROP CONSTRAINT IF EXISTS mm_aircraft_documents_assembly_type_check;

ALTER TABLE public.mm_aircraft_documents
DROP CONSTRAINT IF EXISTS mm_aircraft_documents_requirement_type_check;

-- Migrate existing data: 'prop' → 'propeller'
UPDATE public.mm_aircraft_documents
SET assembly_type = 'propeller'
WHERE assembly_type = 'prop';

-- Add new constraints that match the UI
ALTER TABLE public.mm_aircraft_documents
ADD CONSTRAINT mm_aircraft_documents_assembly_type_check
CHECK (assembly_type IN ('airframe', 'engine', 'apu', 'propeller'));

ALTER TABLE public.mm_aircraft_documents
ADD CONSTRAINT mm_aircraft_documents_requirement_type_check
CHECK (requirement_type IN ('awl', 'sched_mx'));
