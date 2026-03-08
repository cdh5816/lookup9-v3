import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess } from '@/lib/team-helper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    switch (req.method) {
      case 'POST': {
        const { siteId, content, parentId, isInternal } = req.body;
        if (!siteId || !content) return res.status(400).json({ error: { message: 'siteId and content required' } });

        // 현장 접근 검증
        const tm = await verifySiteAccess(session.user.id, siteId);
        if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

        const comment = await prisma.comment.create({
          data: { siteId, content, authorId: session.user.id, parentId: parentId || null, isInternal: isInternal !== false },
          include: { author: { select: { name: true, position: true, department: true } } },
        });
        return res.status(201).json({ data: comment });
      }
      case 'DELETE': {
        const { commentId } = req.body;
        if (!commentId) return res.status(400).json({ error: { message: 'commentId required' } });
        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment || comment.authorId !== session.user.id) return res.status(403).json({ error: { message: 'Forbidden' } });
        await prisma.comment.delete({ where: { id: commentId } });
        return res.status(200).json({ data: { message: 'Deleted' } });
      }
      default:
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }
  } catch (error: any) {
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
