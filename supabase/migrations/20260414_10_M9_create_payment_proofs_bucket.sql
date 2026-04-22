-- [M9] MEDIUM: Provision payment-proofs storage bucket with secure defaults
--
-- Finding: payments.proof_url is schema-defined but no bucket existed
-- to hold the uploaded files. A future implementation risks creating
-- the bucket with insecure defaults (public=true, permissive mime
-- types). Provision it now with strict defaults.
--
-- Design:
--   - public = false (not served via getPublicUrl; must use signed URLs)
--   - 5 MB file size limit
--   - allowed mime types: PDF + raster images only (no SVG, no office docs)
--   - No INSERT/UPDATE/DELETE policies: only service-role (admin client)
--     may write, via markPaymentSubmittedAction or admin upload flows.
--   - SELECT policy: only admins may read via anon/authenticated clients;
--     buyers view their own proof via signed URLs generated server-side
--     with the service-role client.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Admin-only direct read policy (buyers receive signed URLs, not direct reads).
DROP POLICY IF EXISTS "payment_proofs_admin_read" ON storage.objects;
CREATE POLICY "payment_proofs_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.is_admin()
  );
