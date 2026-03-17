-- 안전 보정: PartnerSiteAssign.createdAt 컬럼이 없으면 추가
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PartnerSiteAssign' AND column_name = 'createdAt'
  ) THEN
    ALTER TABLE "PartnerSiteAssign" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- PartnerCompany 테이블도 동일하게 보정
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PartnerCompany' AND column_name = 'createdAt'
  ) THEN
    ALTER TABLE "PartnerCompany" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PartnerCompany' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "PartnerCompany" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- PartnerMember도 동일하게 보정
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PartnerMember' AND column_name = 'createdAt'
  ) THEN
    ALTER TABLE "PartnerMember" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;
