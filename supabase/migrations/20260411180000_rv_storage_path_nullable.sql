-- storage_path is only populated for documents uploaded via Supabase Storage (UI path).
-- Documents ingested via the S3/Textract pipeline have no Supabase storage path
-- and use s3_key as the canonical file reference instead.
ALTER TABLE rv_record_sources ALTER COLUMN storage_path DROP NOT NULL;
