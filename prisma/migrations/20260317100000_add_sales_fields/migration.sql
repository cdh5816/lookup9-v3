-- 영업관리 컬럼 추가: 설계사무소, 담당PM, 자재규모및사양, 구분(관/민), 영업담당, 발주처담당자

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Site' AND column_name='designOffice') THEN
    ALTER TABLE "Site" ADD COLUMN "designOffice" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Site' AND column_name='salesPm') THEN
    ALTER TABLE "Site" ADD COLUMN "salesPm" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Site' AND column_name='materialSpec') THEN
    ALTER TABLE "Site" ADD COLUMN "materialSpec" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Site' AND column_name='sectorType') THEN
    ALTER TABLE "Site" ADD COLUMN "sectorType" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Site' AND column_name='salesOwner') THEN
    ALTER TABLE "Site" ADD COLUMN "salesOwner" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Site' AND column_name='clientContact') THEN
    ALTER TABLE "Site" ADD COLUMN "clientContact" TEXT;
  END IF;
END $$;
