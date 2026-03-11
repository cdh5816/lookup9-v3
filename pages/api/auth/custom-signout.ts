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
    void error;
    return res.status(200).json({ success: true });
  }
}
