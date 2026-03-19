-- AddColumn: Site.productItems (JSON)
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "productItems" JSONB;
