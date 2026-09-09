CREATE POLICY "Allow public read on fotos-publico"
ON storage.objects FOR SELECT
USING (bucket_id = 'fotos-publico');

CREATE POLICY "Allow authenticated upload to fotos-publico"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fotos-publico'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Allow owner or admin update fotos-publico"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fotos-publico'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'fotos-publico'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Allow owner or admin delete fotos-publico"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fotos-publico'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Allow authenticated read on videos-privado"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'videos-privado');

CREATE POLICY "Allow authenticated upload to videos-privado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos-privado'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Allow owner or admin update videos-privado"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos-privado'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'videos-privado'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Allow owner or admin delete videos-privado"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos-privado'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);