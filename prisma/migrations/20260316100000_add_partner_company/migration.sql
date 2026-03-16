-- Add PartnerCompany table for company-based partner management

CREATE TABLE "PartnerCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bizNo" TEXT,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerMember" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerSiteAssign" (
    "id" TEXT NOT NULL,
    "partnerCompanyId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerSiteAssign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerMember_partnerCompanyId_userId_key" ON "PartnerMember"("partnerCompanyId", "userId");
CREATE INDEX "PartnerMember_userId_idx" ON "PartnerMember"("userId");
CREATE UNIQUE INDEX "PartnerSiteAssign_partnerCompanyId_siteId_key" ON "PartnerSiteAssign"("partnerCompanyId", "siteId");
CREATE INDEX "PartnerSiteAssign_siteId_idx" ON "PartnerSiteAssign"("siteId");
CREATE INDEX "PartnerCompany_teamId_idx" ON "PartnerCompany"("teamId");

ALTER TABLE "PartnerCompany" ADD CONSTRAINT "PartnerCompany_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerMember" ADD CONSTRAINT "PartnerMember_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerMember" ADD CONSTRAINT "PartnerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerSiteAssign" ADD CONSTRAINT "PartnerSiteAssign_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerSiteAssign" ADD CONSTRAINT "PartnerSiteAssign_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
