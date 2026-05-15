CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx" ON "Product" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_skuInternal_trgm_idx" ON "Product" USING gin (lower("skuInternal") gin_trgm_ops);
