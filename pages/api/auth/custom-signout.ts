import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions, sessionTokenCookieName } from '@/lib/nextAuth';
import { prisma } from '@/lib/prisma';
import { getCookie } from 'cookies-next';
import env from '@/lib/env';
import { deleteSession } from 'models/session';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authOptions = getAuthOptions(req, res);
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      // 세션이 이미 없으면 성공 처리 (404 방지)
      return res.status(200).json({ success: true });
    }

    if (env.nextAuth.sessionStrategy === 'database') {
      const sessionToken = await getCookie(sessionTokenCookieName, {
        req,
        res,
      });
      const sessionDBEntry = await prisma.session.findFirst({
        where: {
          sessionToken: sessionToken,
        },
      });

      if (sessionDBEntry) {
        await deleteSession({
          where: {
            sessionToken: sessionToken,
          },
        });
      }
    }

    // 쿠키 정리 - Secure 플래그는 HTTPS일 때만
    const isSecure = env.appUrl.startsWith('https://');
    const cookieOptions = `Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    
    res.setHeader('Set-Cookie', [
      `next-auth.session-token=; ${cookieOptions}`,
      `__Secure-next-auth.session-token=; ${cookieOptions}`,
      `next-auth.csrf-token=; ${cookieOptions}`,
      `next-auth.callback-url=; ${cookieOptions}`,
    ]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    // 에러가 나도 200 반환하여 클라이언트에서 정상 리다이렉트 가능하게
    return res.status(200).json({ success: true });
  }
}
