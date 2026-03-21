import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getTeamMemberByUserId } from '@/lib/team-helper';
import { verifySiteAccess } from '@/lib/team-helper';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const tm = await getTeamMemberByUserId(session.user.id);
  if (!tm) return res.status(403).json({ error: { message: 'No team membership' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Site ID required' } });

  const access = await verifySiteAccess(session.user.id, id as string);
  if (!access) return res.status(403).json({ error: { message: 'Site access denied' } });

  try {
    switch (req.method) {
      case 'GET': return await handleGET(req, res, id);
      case 'POST': return await handlePOST(req, res, id, tm, session.user.id);
      case 'DELETE': return await handleDELETE(req, res, id, tm, session.user.id);
      default:
        res.setHeader('Allow', 'GET, POST, DELETE');
        return res.status(405).json({ error: { message: `Method ${req.method} Not Allowed` } });
    }
  } catch (error: any) {
    console.error('Photos API error:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}

const handleGET = async (_req: NextApiRequest, res: NextApiResponse, siteId: string) => {
  const photos = await prisma.sitePhoto.findMany({
    where: { siteId },
    include: {
      uploadedBy: { select: { name: true, position: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.status(200).json({ data: photos });
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, siteId: string, tm: any, userId: string) => {
  const { fileData, fileName, fileSize, caption, category, takenAt } = req.body;

  if (!fileData) {
    return res.status(400).json({ error: { message: '이미지 데이터가 필요합니다.' } });
  }

  // base64 data URL 검증
  if (!fileData.startsWith('data:image/')) {
    return res.status(400).json({ error: { message: '이미지 파일만 업로드 가능합니다.' } });
  }

  // 파일 크기 제한 (약 8MB base64)
  if (fileData.length > 11 * 1024 * 1024) {
    return res.status(400).json({ error: { message: '파일 크기가 8MB를 초과합니다.' } });
  }

  const photo = await prisma.sitePhoto.create({
    data: {
      siteId,
      teamId: tm.teamId,
      uploadedById: userId,
      fileUrl: fileData,
      fileName: fileName || 'photo.jpg',
      fileSize: fileSize || null,
      caption: caption || null,
      category: category || 'PROGRESS',
      takenAt: takenAt ? new Date(takenAt) : null,
    },
    include: {
      uploadedBy: { select: { name: true, position: true } },
    },
  });

  return res.status(201).json({ data: photo });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, siteId: string, tm: any, userId: string) => {
  const { photoId } = req.body;
  if (!photoId) return res.status(400).json({ error: { message: 'photoId required' } });

  const photo = await prisma.sitePhoto.findFirst({
    where: { id: photoId, siteId },
  });
  if (!photo) return res.status(404).json({ error: { message: 'Photo not found' } });

  // 본인 또는 관리자만 삭제
  const canDelete = photo.uploadedById === userId ||
    ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(tm.role);
  if (!canDelete) return res.status(403).json({ error: { message: '삭제 권한이 없습니다.' } });

  await prisma.sitePhoto.delete({ where: { id: photoId } });
  return res.status(200).json({ data: { deleted: true } });
};
