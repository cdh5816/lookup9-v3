-- 검수 요청/승인 테이블
CREATE TABLE IF NOT EXISTS "Inspection" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "siteId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "inspectionType" TEXT NOT NULL DEFAULT 'DELIVERY',
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "result" TEXT,
  "resultNote" TEXT,
  "signatureData" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Inspection_siteId_idx" ON "Inspection"("siteId");
CREATE INDEX IF NOT EXISTS "Inspection_teamId_idx" ON "Inspection"("teamId");
CREATE INDEX IF NOT EXISTS "Inspection_status_idx" ON "Inspection"("status");
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 공유 일정 캘린더 테이블
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "siteId" TEXT,
  "teamId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'GENERAL',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "location" TEXT,
  "createdById" TEXT NOT NULL,
  "isShared" BOOLEAN NOT NULL DEFAULT true,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CalendarEvent_siteId_idx" ON "CalendarEvent"("siteId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_teamId_idx" ON "CalendarEvent"("teamId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_startDate_idx" ON "CalendarEvent"("startDate");

-- QR 방문 기록 테이블
CREATE TABLE IF NOT EXISTS "QRVisit" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "siteId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "visitorName" TEXT NOT NULL,
  "visitorCompany" TEXT,
  "visitorPhone" TEXT,
  "visitPurpose" TEXT,
  "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkOutAt" TIMESTAMP(3),
  "qrToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QRVisit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "QRVisit_siteId_idx" ON "QRVisit"("siteId");
CREATE INDEX IF NOT EXISTS "QRVisit_teamId_idx" ON "QRVisit"("teamId");
CREATE INDEX IF NOT EXISTS "QRVisit_qrToken_idx" ON "QRVisit"("qrToken");
ALTER TABLE "QRVisit" ADD CONSTRAINT "QRVisit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 현장 사진 테이블 (공정 현황판용)
CREATE TABLE IF NOT EXISTS "SitePhoto" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "siteId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "caption" TEXT,
  "category" TEXT NOT NULL DEFAULT 'PROGRESS',
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "fileSize" INTEGER,
  "takenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SitePhoto_siteId_idx" ON "SitePhoto"("siteId");
CREATE INDEX IF NOT EXISTS "SitePhoto_category_idx" ON "SitePhoto"("category");
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
