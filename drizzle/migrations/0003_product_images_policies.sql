CREATE POLICY "public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "staff upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "staff update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "staff delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');