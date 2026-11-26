-- 003 — publish the imported records
--
-- Decision: the Puerto Princesa tourism office publishes the imported records
-- as-is, so the public directory is not empty. This is a content decision, not
-- a technical one.
--
-- The public API only serves records whose editorial_status is 'approved' or
-- 'published' (see approved() in lib/model.ts). Everything imported from the
-- source spreadsheet arrived as 'imported', so the public site rendered zero
-- businesses even with a healthy database.
--
-- Both places must be updated:
--   1. businesses            — the normalised table (future data layer)
--   2. directory_workspace   — the JSONB blob the current app actually reads
--
-- Applied to Neon on 2026-11-26: 3,135 rows approved in each.
--
-- To revert:
--   UPDATE businesses SET editorial_status='imported' WHERE editorial_status='approved';
--   and the inverse jsonb_set on directory_workspace.

-- 1. normalised table
UPDATE businesses
SET editorial_status = 'approved',
    updated_at = now()
WHERE editorial_status = 'imported';

-- 2. JSONB workspace — rewrite each business object in place, preserving order
UPDATE directory_workspace
SET payload = jsonb_set(payload, '{businesses}', (
      SELECT jsonb_agg(
               CASE WHEN b->>'editorial_status' IS NULL
                          OR b->>'editorial_status' = 'imported'
                    THEN b || '{"editorial_status":"approved"}'::jsonb
                    ELSE b END
               ORDER BY ord)
      FROM jsonb_array_elements(payload->'businesses') WITH ORDINALITY AS t(b, ord)
    ))
WHERE id = 1;

INSERT INTO schema_migrations (version, note)
VALUES ('003_publish_imported',
        'publish 3135 imported records: editorial_status imported -> approved in businesses and directory_workspace')
ON CONFLICT (version) DO NOTHING;
