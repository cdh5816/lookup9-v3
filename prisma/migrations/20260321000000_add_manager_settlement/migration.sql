-- 현장 담당자 (내부 PM)
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "siteManager" TEXT;

-- 실정보고 금액
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "settlementAmount" DECIMAL(15,0);

-- 실정보고 비고
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "settlementNote" TEXT;
