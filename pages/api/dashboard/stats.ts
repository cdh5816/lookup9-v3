import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  try {
    const isPartner = tm.role === 'PARTNER';
    const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(tm.role);
    const baseWhere: any = { teamId: tm.teamId };

    // PARTNER: PartnerSiteAssign + SiteAssignment 합집합으로 현장 범위 결정
    if (isPartner) {
      const partnerMember = await prisma.partnerMember.findFirst({
        where: { userId: tm.userId },
        select: { partnerCompanyId: true },
      });

      let partnerSiteIds: string[] = [];
      if (partnerMember) {
        const assigns = await prisma.partnerSiteAssign.findMany({
          where: { partnerCompanyId: partnerMember.partnerCompanyId },
          select: { siteId: true },
        });
        partnerSiteIds = assigns.map((a) => a.siteId);
      }

      const directAssigns = await prisma.siteAssignment.findMany({
        where: { userId: tm.userId },
        select: { siteId: true },
      });
      const directSiteIds = directAssigns.map((a) => a.siteId);

      const allSiteIds = Array.from(new Set([...partnerSiteIds, ...directSiteIds]));
      baseWhere.id = allSiteIds.length > 0 ? { in: allSiteIds } : { in: ['__none__'] };
    } else if (isExternal) {
      // GUEST, VIEWER
      baseWhere.assignments = { some: { userId: tm.userId } };
    }

    // 진행중 현장
    const activeSites = await prisma.site.count({
      where: { ...baseWhere, status: { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] } },
    });

    // 이슈 현장
    const issueSites = await prisma.site.count({
      where: {
        ...baseWhere,
        issues: { some: { status: { not: '완료' } } },
      },
    });

    // 최근 현장
    const recentSites = await prisma.site.findMany({
      where: { ...baseWhere, status: { in: ['CONTRACT_ACTIVE', 'COMPLETED', 'WARRANTY'] } },
      include: {
        client: { select: { name: true } },
        contracts: { select: { quantity: true, isAdditional: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        shipments: { select: { quantity: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    // 미읽은 알림
    const unreadNotifications = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    });

    // 미읽은 쪽지
    const unreadMessages = await prisma.message.count({
      where: { receiverId: session.user.id, isRead: false },
    });

    // 미처리 요청
    const openRequests = await prisma.request.count({
      where: {
        site: baseWhere,
        status: { notIn: ['완료', '반려'] },
      },
    });

    // 공지사항
    const notices = await prisma.notice.findMany({
      where: { OR: [{ teamId: tm.teamId }, { teamId: null }] },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      include: { author: { select: { name: true, position: true } } },
    });

    // 하자보수 만료 임박 (90일 이내)
    const ninetyDaysLater = new Date();
    ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
    const warrantySites = await prisma.site.findMany({
      where: {
        ...baseWhere,
        completionDate: { not: null },
      },
      select: { id: true, name: true, completionDate: true, siteType: true },
    });
    const warrantyExpiring = warrantySites
      .map((s) => {
        const exp = new Date(s.completionDate!);
        exp.setFullYear(exp.getFullYear() + 2);
        return { ...s, expiryDate: exp, daysLeft: Math.ceil((exp.getTime() - Date.now()) / 86400000) };
      })
      .filter((s) => s.daysLeft >= 0 && s.daysLeft <= 90)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    return res.status(200).json({
      data: {
        activeSites,
        issueSites,
        openRequests,
        unreadNotifications,
        unreadMessages,
        recentSites,
        notices,
        warrantyExpiring,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message } });
  }
}
