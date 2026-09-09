CREATE POLICY "Allow anon read on videos-privado perfil prefix"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'videos-privado'
  AND name LIKE 'perfil/%'
);