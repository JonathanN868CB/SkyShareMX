-- ============================================================================
-- MM Revision & Audit Tracking — Seed Data
-- ============================================================================
-- Populated from "MM Revision and Audit Tracking.xlsx" spreadsheet.
-- Source documents split by section when OEM chapters carry independent revisions.
-- Aircraft linkages reference current aircraft table via registration JOIN.
-- ============================================================================

-- --------------------------------------------------------------------------
-- SOURCE DOCUMENTS
-- --------------------------------------------------------------------------
-- Note: Some OEM manuals have different revision levels per chapter/section.
-- In those cases we create separate source_document rows per auditable section.
-- --------------------------------------------------------------------------

INSERT INTO mm_source_documents (document_number, document_name, current_revision, current_rev_date) VALUES

-- Pilatus Airframe Manuals
('PIL-02049',       'Pilatus PC-12/45 & PC-12/47 Maintenance Manual',   '50',  '2026-01-19'),
('PIL-02300',       'Pilatus PC-12/47E Maintenance Manual',             '35',  '2025-01-27'),
('PIL-02436',       'Pilatus PC-12/47E NGX Maintenance Manual',         '13',  '2025-01-26'),

-- P&WC PT6A Engine
('PWC-SB14002',     'P&WC PT6A Service Bulletin 14002 (AWL)',           '27',  '2021-08-06'),
('PWC-3038336',     'P&WC PT6A Maintenance Manual',                     '62',  '2025-10-06'),

-- P&WC PT6E Engine (NGX)
('PWC-PT6E-MM',     'P&WC PT6E-67XP Engine Maintenance Manual',        'TBD', NULL),

-- Propeller — Hartzell / Hamilton Standard
('HC-MAN147',       'Hartzell Propeller Maintenance Manual 147',        '23',  '2025-09-01'),

-- Propeller — MT Propeller
('MT-SB1',          'MT Propeller Service Bulletin 1',                  '11',  '2025-10-31'),
('MT-E1083',        'MT Propeller Overhaul Manual E-1083',              '39',  '2024-05-15'),

-- Cessna Citation CJ2 (525A) — split by chapter (different revisions)
('525AMM-CH04',     'Cessna 525A MM — Chapter 04 (AWL)',               '11',  '2022-12-07'),
('525AMM-CH05',     'Cessna 525A MM — Chapter 05 (Sched Mx)',          '21',  '2023-11-01'),

-- Williams FJ44-2C Engine
('WI-64135',        'Williams FJ44-2C Engine Manual',                   '69',  '2025-09-08'),

-- Cessna Citation M2 (525) Airframe
('525MM-M2',        'Cessna Citation M2 Maintenance Manual',            '10',  '2025-09-01'),

-- Williams FJ44-4A Engine (M2 Gen2)
('WI-FJ44-4A-MM',  'Williams FJ44-4A Engine Manual',                   'TBD', NULL),

-- Cessna Citation 560XL — split by chapter (different revisions)
('56XMM-CH04',      'Cessna 560XL MM — Chapter 04 (AWL)',              '17',  '2024-07-03'),
('56XMM-CH05',      'Cessna 560XL MM — Chapter 05 (Sched Mx)',         '50',  '2025-07-15'),

-- P&WC PW545A Engine
('PWC-30J1272',     'P&WC PW545A Engine Manual',                       '64',  '2025-10-20'),

-- P&WC PW545C Engine (XLS+ variant)
('PWC-30J2302',     'P&WC PW545C Engine Manual (AWL)',                  '37',  '2025-04-21'),
('PWC-30J2602',     'P&WC PW545C Engine Manual (Sched Mx)',             '37',  '2025-04-21'),

-- IAI Gulfstream G200
('IAI-G200-1001-06','IAI G200 Maintenance Manual',                      '39',  '2025-08-15'),

-- P&WC PW306A Engine
('PWC-30B1412',     'P&WC PW306A Engine Manual',                       '63',  '2025-11-03'),

-- Embraer EMB-505 Phenom 300 — split by part (different revisions)
('EMB-AMM2757-PT-IV',    'Embraer EMB-505 AMM 2757 — Part IV SMR (AWL)',       '2',   '2024-01-11'),
('EMB-AMM2757-PT-III',   'Embraer EMB-505 AMM 2757 — Part III SMR (Sched Mx)', '8',   '2025-11-06'),
('EMB-AMM2757-ENG',      'Embraer EMB-505 AMM 2757 — Engine (PW535E1)',         '32',  '2025-10-20'),

-- Gulfstream G450
('GAC-G450-AMM',    'Gulfstream G450 AMM',                             '34',  '2025-04-30'),

-- Rolls-Royce Tay 611-8C Engine
('RR-T-TAY-6RR',   'Rolls-Royce Tay 611-8C Engine Manual',            '34',  '2025-04-30'),

-- Gulfstream GV
('GAC-GV-AMM',      'Gulfstream GV AMM',                               '59',  '2025-01-31'),

-- Rolls-Royce BR710C4-11 Engine (GV)
('RR-BR710-MM',     'Rolls-Royce BR710C4-11 Engine Manual',            'TBD', NULL),

-- Embraer Legacy 650 (EMB-135BJ) — placeholder
('EMB-135BJ-AMM',   'Embraer Legacy 650 (EMB-135BJ) AMM',              'TBD', NULL),
('RR-AE3007-MM',    'Rolls-Royce AE3007A1E Engine Manual',             'TBD', NULL),

-- Embraer Phenom 100 (EMB-500) — placeholder
('EMB-500-AMM',     'Embraer Phenom 100 (EMB-500) AMM',                'TBD', NULL),
('PWC-PW617F-MM',   'P&WC PW617F-E Engine Manual',                     'TBD', NULL),

-- HC Prop for NGX
('HC-E5A-31A-MM',   'Hartzell HC-E5A-31A Propeller Maintenance Manual', 'TBD', NULL);


-- ============================================================================
-- AIRCRAFT DOCUMENTS — Per-tail linkages
-- ============================================================================
-- Pattern: JOIN aircraft via registration, JOIN source_documents via document_number
-- ============================================================================

-- --------------------------------------------------------------------------
-- PC-12/45 — Legacy: N499CB (Finnoff 67P), N515RP (67B), N870CB (67B)
-- --------------------------------------------------------------------------

-- All PC-12/45: Airframe AWL & Sched Mx (MM 02049)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'awl', 'Ch 04', NULL
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N499CB', 'N515RP', 'N870CB') AND sd.document_number = 'PIL-02049';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'sched_mx', 'Ch 05', NULL
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N499CB', 'N515RP', 'N870CB') AND sd.document_number = 'PIL-02049';

-- N499CB: Engine PT6A-67P (Finnoff) — SB 14002 Table 8
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'awl', 'Table 8', 'PT6A-67P'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N499CB' AND sd.document_number = 'PWC-SB14002';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'sched_mx', '72-00-00 Sec 9', 'PT6A-67P'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N499CB' AND sd.document_number = 'PWC-3038336';

-- N499CB: Prop MTV-47 (two manuals)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', NULL, 'MTV-47-1-N-C-F-R(P)'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N499CB' AND sd.document_number = 'MT-SB1';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 7', 'MTV-47-1-N-C-F-R(P)'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N499CB' AND sd.document_number = 'MT-E1083';

-- N515RP, N870CB: Engine PT6A-67B — SB 14002 Table 1
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'awl', 'Table 1', 'PT6A-67B'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N515RP', 'N870CB') AND sd.document_number = 'PWC-SB14002';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'sched_mx', '72-00-00 Sec 9', 'PT6A-67B'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N515RP', 'N870CB') AND sd.document_number = 'PWC-3038336';

-- N515RP: Prop HC-E4A-3D
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 5', 'HC-E4A-3D'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N515RP' AND sd.document_number = 'HC-MAN147';

-- N870CB: Prop HC-E4A-3D
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 5', 'HC-E4A-3D'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N870CB' AND sd.document_number = 'HC-MAN147';

-- --------------------------------------------------------------------------
-- PC-12/47 — Legacy: N739S, N863CB
-- --------------------------------------------------------------------------

-- Airframe (same MM 02049 as PC-12/45)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      'Ch 04', NULL::text),
  ('airframe', 'sched_mx', 'Ch 05', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N739S', 'N863CB') AND sd.document_number = 'PIL-02049';

-- Engine PT6A-67B — SB 14002 Table 1, MM 3038336
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'awl', 'Table 1', 'PT6A-67B'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N739S', 'N863CB') AND sd.document_number = 'PWC-SB14002';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'sched_mx', '72-00-00 Sec 9', 'PT6A-67B'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N739S', 'N863CB') AND sd.document_number = 'PWC-3038336';

-- N739S: Prop HC-E5A-3A
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 5', 'HC-E5A-3A'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N739S' AND sd.document_number = 'HC-MAN147';

-- N863CB: Prop HC-E4A-3D
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 5', 'HC-E4A-3D'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N863CB' AND sd.document_number = 'HC-MAN147';

-- --------------------------------------------------------------------------
-- PC-12/47E — NG: N413UU, N418T, N477KR, N963CB
-- --------------------------------------------------------------------------

-- All 47E: Airframe (MM 02300)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      'Ch 04', NULL::text),
  ('airframe', 'sched_mx', 'Ch 05', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N413UU', 'N418T', 'N477KR', 'N963CB') AND sd.document_number = 'PIL-02300';

-- All 47E: Engine PT6A-67P — SB 14002 Table 8, MM 3038336
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'awl', 'Table 8', 'PT6A-67P'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N413UU', 'N418T', 'N477KR', 'N963CB') AND sd.document_number = 'PWC-SB14002';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'sched_mx', '72-00-00 Sec 9', 'PT6A-67P'
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N413UU', 'N418T', 'N477KR', 'N963CB') AND sd.document_number = 'PWC-3038336';

-- N413UU: Prop HC-E4A-3D
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 5', 'HC-E4A-3D'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N413UU' AND sd.document_number = 'HC-MAN147';

-- N418T, N477KR: Prop HC-E5A-3A
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 5', 'HC-E5A-3A'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N418T', 'N477KR') AND sd.document_number = 'HC-MAN147';

-- N963CB: Prop MTV-47 (two manuals)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', NULL, 'MTV-47-1-N-C-F-R(P)'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N963CB' AND sd.document_number = 'MT-SB1';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', 'Sec 7', 'MTV-47-1-N-C-F-R(P)'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N963CB' AND sd.document_number = 'MT-E1083';

-- --------------------------------------------------------------------------
-- PC-12 NGX: N511DR
-- --------------------------------------------------------------------------

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      'Ch 04', NULL::text),
  ('airframe', 'sched_mx', 'Ch 05', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N511DR' AND sd.document_number = 'PIL-02436';

-- Engine PT6E-67XP (placeholder — no doc detail in spreadsheet)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      NULL::text, 'PT6E-67XP'::text),
  ('engine', 'sched_mx', NULL,       'PT6E-67XP')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N511DR' AND sd.document_number = 'PWC-PT6E-MM';

-- Prop HC-E5A-31A
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'prop', 'sched_mx', NULL, 'HC-E5A-31A'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N511DR' AND sd.document_number = 'HC-E5A-31A-MM';

-- --------------------------------------------------------------------------
-- Citation CJ2 525A: N744CB, N868CB, N871CB
-- --------------------------------------------------------------------------

-- Airframe AWL (Ch 04, separate doc due to different rev)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'awl', 'Chapter 04', NULL
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N744CB', 'N868CB', 'N871CB') AND sd.document_number = '525AMM-CH04';

-- Airframe Sched Mx (Ch 05, separate doc)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'sched_mx', 'Chapter 05', NULL
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N744CB', 'N868CB', 'N871CB') AND sd.document_number = '525AMM-CH05';

-- Engine FJ44-2C
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      '05-10-00', 'FJ44-2C'::text),
  ('engine', 'sched_mx', '05-20-00', 'FJ44-2C')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N744CB', 'N868CB', 'N871CB') AND sd.document_number = 'WI-64135';

-- --------------------------------------------------------------------------
-- Citation M2 Gen2: N785PD
-- --------------------------------------------------------------------------

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      'Chapter 04', NULL::text),
  ('airframe', 'sched_mx', 'Chapter 05', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N785PD' AND sd.document_number = '525MM-M2';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      NULL::text, 'FJ44-4A'::text),
  ('engine', 'sched_mx', NULL,       'FJ44-4A')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N785PD' AND sd.document_number = 'WI-FJ44-4A-MM';

-- --------------------------------------------------------------------------
-- Citation 560XL / XLS+: N606CB, N766CB (PW545A), N6TM (PW545C)
-- --------------------------------------------------------------------------

-- All three: Airframe AWL (56XMM Ch 04)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'awl', 'Chapter 04', NULL
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N606CB', 'N766CB', 'N6TM') AND sd.document_number = '56XMM-CH04';

-- All three: Airframe Sched Mx (56XMM Ch 05)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'sched_mx', 'Chapter 05', NULL
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N606CB', 'N766CB', 'N6TM') AND sd.document_number = '56XMM-CH05';

-- N606CB, N766CB: Engine PW545A
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      'AWL',   'PW545A'::text),
  ('engine', 'sched_mx', '05.20', 'PW545A')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N606CB', 'N766CB') AND sd.document_number = 'PWC-30J1272';

-- N6TM: Engine PW545C (separate AWL and Sched documents)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'awl', 'AWL', 'PW545C'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N6TM' AND sd.document_number = 'PWC-30J2302';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'sched_mx', '05.20', 'PW545C'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N6TM' AND sd.document_number = 'PWC-30J2602';

-- All three: APU (MSG-3, tracked via airframe MM Ch 05)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'apu', 'sched_mx', 'Chapter 05', 'APU (MSG-3)'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N606CB', 'N766CB', 'N6TM') AND sd.document_number = '56XMM-CH05';

-- --------------------------------------------------------------------------
-- G200: N612FA, N860CB, N861CB
-- --------------------------------------------------------------------------

-- Airframe AWL & Sched Mx (G200 AMM)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      '05-10-11', NULL::text),
  ('airframe', 'sched_mx', '05-20-01', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N612FA', 'N860CB', 'N861CB') AND sd.document_number = 'IAI-G200-1001-06';

-- Engine PW306A
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      'AWL Table 1', 'PW306A'::text),
  ('engine', 'sched_mx', '05.20',       'PW306A')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N612FA', 'N860CB', 'N861CB') AND sd.document_number = 'PWC-30B1412';

-- APU GTCP36-150[IAI] (MSG-3, tracked via G200 AMM)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('apu', 'awl',      '05-20-01', 'GTCP36-150[IAI]'::text),
  ('apu', 'sched_mx', '05-10-01', 'GTCP36-150[IAI]')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N612FA', 'N860CB', 'N861CB') AND sd.document_number = 'IAI-G200-1001-06';

-- --------------------------------------------------------------------------
-- Phenom 300E (EMB-505): N409KG
-- --------------------------------------------------------------------------

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'awl', 'Part IV SMR', NULL
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N409KG' AND sd.document_number = 'EMB-AMM2757-PT-IV';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'airframe', 'sched_mx', 'Part III SMR', NULL
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration = 'N409KG' AND sd.document_number = 'EMB-AMM2757-PT-III';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      'Task 00-00-00-860-802', 'PW535E1'::text),
  ('engine', 'sched_mx', 'Task 72-00-00-212-801', 'PW535E1')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N409KG' AND sd.document_number = 'EMB-AMM2757-ENG';

-- --------------------------------------------------------------------------
-- G450: N787JS, N663CB
-- --------------------------------------------------------------------------

-- Airframe (G450 AMM)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      '05-10-10',          NULL::text),
  ('airframe', 'sched_mx', '05-10-00, 05-20-00', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N787JS', 'N663CB') AND sd.document_number = 'GAC-G450-AMM';

-- Engine RR Tay 611-8C — AWL from engine manual, Sched from G450 AMM
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'awl', 'Ch 5', 'Tay 611-8C'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N787JS', 'N663CB') AND sd.document_number = 'RR-T-TAY-6RR';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, 'engine', 'sched_mx', '05-20-00', 'Tay 611-8C'
FROM aircraft a JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
WHERE ar.registration IN ('N787JS', 'N663CB') AND sd.document_number = 'GAC-G450-AMM';

-- APU GTCP36-150(GIV) (from G450 AMM)
INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('apu', 'awl',      '05-10-00', 'GTCP36-150(GIV)'::text),
  ('apu', 'sched_mx', '05-20-00', 'GTCP36-150(GIV)')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration IN ('N787JS', 'N663CB') AND sd.document_number = 'GAC-G450-AMM';

-- --------------------------------------------------------------------------
-- GV: N563CB
-- --------------------------------------------------------------------------

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      '05-10-10',          NULL::text),
  ('airframe', 'sched_mx', '05-10-00, 05-20-00', NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N563CB' AND sd.document_number = 'GAC-GV-AMM';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      NULL::text, 'BR710C4-11'::text),
  ('engine', 'sched_mx', NULL,       'BR710C4-11')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N563CB' AND sd.document_number = 'RR-BR710-MM';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('apu', 'awl',      NULL::text, 'GTCP36-150(GIV)'::text),
  ('apu', 'sched_mx', NULL,       'GTCP36-150(GIV)')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N563CB' AND sd.document_number = 'GAC-GV-AMM';

-- --------------------------------------------------------------------------
-- Legacy 650 (EMB-135BJ): N650JF — placeholder (not in spreadsheet)
-- --------------------------------------------------------------------------

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      NULL::text, NULL::text),
  ('airframe', 'sched_mx', NULL,       NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N650JF' AND sd.document_number = 'EMB-135BJ-AMM';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      NULL::text, 'AE3007A1E'::text),
  ('engine', 'sched_mx', NULL,       'AE3007A1E')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N650JF' AND sd.document_number = 'RR-AE3007-MM';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('apu', 'awl',      NULL::text, NULL::text),
  ('apu', 'sched_mx', NULL,       NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N650JF' AND sd.document_number = 'EMB-135BJ-AMM';

-- --------------------------------------------------------------------------
-- Phenom 100 (EMB-500): N450JF — placeholder (not in spreadsheet)
-- --------------------------------------------------------------------------

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('airframe', 'awl',      NULL::text, NULL::text),
  ('airframe', 'sched_mx', NULL,       NULL)
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N450JF' AND sd.document_number = 'EMB-500-AMM';

INSERT INTO mm_aircraft_documents (aircraft_id, source_document_id, assembly_type, requirement_type, section, assembly_detail)
SELECT a.id, sd.id, v.assembly_type, v.requirement_type, v.section, v.assembly_detail
FROM aircraft a
JOIN aircraft_registrations ar ON ar.aircraft_id = a.id AND ar.is_current = true
CROSS JOIN mm_source_documents sd
CROSS JOIN (VALUES
  ('engine', 'awl',      NULL::text, 'PW617F-E'::text),
  ('engine', 'sched_mx', NULL,       'PW617F-E')
) AS v(assembly_type, requirement_type, section, assembly_detail)
WHERE ar.registration = 'N450JF' AND sd.document_number = 'PWC-PW617F-MM';


-- ============================================================================
-- MEL / POLICY LETTER TRACKING
-- ============================================================================

INSERT INTO mm_mel_tracking (model_family, document_type, document_number, revision_number, revision_date, review_date, next_due_date, update_needed) VALUES

-- PC-12/45 Legacy
('PC-12/45 — Legacy', 'mmel',           'MMEL M PC-12 R5',       '5',  '2025-06-26', '2025-07-21', '2025-09-30', false),
('PC-12/45 — Legacy', 'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('PC-12/45 — Legacy', 'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('PC-12/45 — Legacy', 'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- PC-12/47 Legacy (same MMEL as PC-12/45)
('PC-12/47 — Legacy', 'mmel',           'MMEL M PC-12 R5',       '5',  '2025-06-26', '2025-07-21', '2025-09-30', false),
('PC-12/47 — Legacy', 'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('PC-12/47 — Legacy', 'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('PC-12/47 — Legacy', 'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- PC-12/47E NG
('PC-12/47E — NG',    'mmel',           'MMEL M PC-12/47E R5',   '5',  '2022-12-27', '2025-06-20', '2025-09-30', false),
('PC-12/47E — NG',    'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('PC-12/47E — NG',    'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('PC-12/47E — NG',    'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- PC-12 NGX (same MMEL as 47E per spreadsheet)
('PC-12 — NGX',       'mmel',           'MMEL M PC-12/47E R5',   '5',  '2022-12-27', '2025-06-20', '2025-09-30', false),
('PC-12 — NGX',       'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('PC-12 — NGX',       'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('PC-12 — NGX',       'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- Citation CJ2 (525A)
('Citation CJ2 (525A)', 'mmel',          'MMEL M CE-525A R2',       '2',  '2006-03-27', '2025-06-20', '2025-09-30', false),
('Citation CJ2 (525A)', 'mmel',          'MMEL M CE-525A R2 Pt91',  '2',  '2006-03-27', '2025-06-20', '2025-09-30', false),
('Citation CJ2 (525A)', 'policy_letter', 'PL 25',                   '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('Citation CJ2 (525A)', 'policy_letter', 'PL 34',                   '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('Citation CJ2 (525A)', 'policy_letter', 'PL 36',                   '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- Citation M2 Gen2
('Citation M2 Gen2',  'mmel',           'MMEL M CE-525 R4',      '4',  '2020-01-16', NULL, NULL, false),
('Citation M2 Gen2',  'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('Citation M2 Gen2',  'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('Citation M2 Gen2',  'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- Citation 560XL / XLS+
('Citation 560XL / XLS+', 'mmel',           'MMEL M CE-560XL R8',    '8',  '2021-07-23', '2025-06-20', '2025-09-30', false),
('Citation 560XL / XLS+', 'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('Citation 560XL / XLS+', 'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('Citation 560XL / XLS+', 'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- G200
('G200',              'mmel',           'MMEL M IA-Galaxy-G-200 Rev 7', '7', '2024-04-30', '2025-06-20', '2025-09-30', false),
('G200',              'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('G200',              'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('G200',              'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- Phenom 300E (EMB-505)
('Phenom 300E (EMB-505)', 'mmel',           'MMEL M EMB-505 R4',     '4',  '2023-10-07', '2025-06-20', '2025-09-30', false),
('Phenom 300E (EMB-505)', 'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('Phenom 300E (EMB-505)', 'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('Phenom 300E (EMB-505)', 'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- G450
('G450',              'mmel',           'MMEL M G-V GIV-X GV-SP R11', '11', '2023-05-25', '2025-06-20', '2025-09-30', false),
('G450',              'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('G450',              'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('G450',              'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false),

-- GV
('GV',                'mmel',           'MMEL M G-V GIV-X GV-SP R11', '11', '2023-05-25', '2025-06-20', '2025-09-30', false),
('GV',                'policy_letter',  'PL 25',                 '23', '2023-06-12', '2025-06-20', '2025-09-30', false),
('GV',                'policy_letter',  'PL 34',                 '5',  '2024-04-23', '2025-06-20', '2025-09-30', false),
('GV',                'policy_letter',  'PL 36',                 '3',  '2020-06-16', '2025-06-20', '2025-09-30', false);

-- Note: Legacy 650 and Phenom 100 MEL data not in spreadsheet — to be added manually
