-- [M8] MEDIUM: Tighten product-images storage bucket
--
-- Finding:
--   1. The product-images bucket allowed image/svg+xml uploads. Because
--      the bucket is public and files are served from the Supabase
--      origin, an attacker-controlled SVG could host JavaScript or
--      embed external references, enabling stored XSS.
--   2. No explicit storage.objects policies existed for the bucket.
--      Reads relied on the bucket's `public=true` flag; writes relied
--      on the absence of any INSERT/UPDATE/DELETE policy. Add explicit
--      policies so intent is visible in the schema.
--
-- Fix:
--   - Remove image/svg+xml from allowed_mime_types.
--   - Add an explicit "anyone can read" SELECT policy (mirrors the
--     current public-bucket behaviour but in code).
--   - Do NOT add INSERT/UPDATE/DELETE policies: the service-role
--     admin client bypasses RLS and is the only legitimate writer;
--     absence of a policy blocks everyone else.

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
     'image/jpeg',
     'image/png',
     'image/webp',
     'image/gif'
   ]
 WHERE id = 'product-images';

-- Explicit public-read policy (idempotent).
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');
