import type {
  NextApiRequest,
  NextApiResponse,
  GetServerSidePropsContext,
} from 'next';
import { Account, NextAuthOptions, Profile, User } from 'next-auth';
import BoxyHQSAMLProvider from 'next-auth/providers/boxyhq-saml';
import CredentialsProvider from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/email';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { Provider } from 'next-auth/providers';
import { setCookie, getCookie } from 'cookies-next';
import { encode, decode } from 'next-auth/jwt';
import { randomUUID } from 'crypto';

import { Role } from '@prisma/client';
import { getAccount } from 'models/account';
import { addTeamMember, getTeam } from 'models/team';
import { createUser, getUser } from 'models/user';
import { verifyPassword } from '@/lib/auth';
import { isEmailAllowed } from '@/lib/email/utils';
import env from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { isAuthProviderEnabled } from '@/lib/auth';
import { validateRecaptcha } from '@/lib/recaptcha';
import { sendMagicLink } from '@/lib/email/sendMagicLink';
import {
  clearLoginAttempts,
  exceededLoginAttemptsThreshold,
  incrementLoginAttempts,
} from '@/lib/accountLock';
import { slackNotify } from './slack';
import { maxLengthPolicies } from '@/lib/common';
import { forceConsume } from '@/lib/server-common';

const adapter = PrismaAdapter(prisma);
const providers: Provider[] = [];

// 세션 만료 시간
const SESSION_MAXAGE_REMEMBER = 14 * 24 * 60 * 60;  // 자동로그인: 14일
const SESSION_MAXAGE_SESSION  =  8 * 60 * 60;        // 미체크: 8시간 (브라우저 종료 독립적)

const useSecureCookie = env.appUrl.startsWith('https://');

export const sessionTokenCookieName =
  (useSecureCookie ? '__Secure-' : '') + 'next-auth.session-token';

if (isAuthProviderEnabled('credentials')) {
  providers.push(
    CredentialsProvider({
      id: 'credentials',
      credentials: {
        username: { type: 'text' },
        password: { type: 'password' },
        recaptchaToken: { type: 'text' },
        rememberMe: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) {
          throw new Error('no-credentials');
        }

        const { username, password, recaptchaToken } = credentials;

        await validateRecaptcha(recaptchaToken);

        if (!username || !password) {
          return null;
        }

        const isEmail = username.includes('@');
        let user = isEmail
          ? await getUser({ email: username })
          : await getUser({ username }).catch(() => null);

        if (!user && !isEmail) {
          user = await getUser({ email: `${username}@internal.lookup9` }).catch(() => null);
        }

        if (!user) {
          throw new Error('invalid-credentials');
        }

        if (exceededLoginAttemptsThreshold(user)) {
          throw new Error('exceeded-login-attempts');
        }

        if (env.confirmEmail && !user.emailVerified) {
          throw new Error('confirm-your-email');
        }

        const hasValidPassword = await verifyPassword(
          password,
          user?.password as string
        );

        if (!hasValidPassword) {
          if (
            exceededLoginAttemptsThreshold(await incrementLoginAttempts(user))
          ) {
            throw new Error('exceeded-login-attempts');
          }
          throw new Error('invalid-credentials');
        }

        await clearLoginAttempts(user);

        if (user.lockedAt) {
          throw new Error('account-locked');
        }

        // rememberMe 여부를 user 객체에 임시 저장 (JWT/session 콜백으로 전달)
        return {
          ...user,
          rememberMe: credentials.rememberMe === '1',
        } as any;
      },
    })
  );
}

if (isAuthProviderEnabled('github')) {
  providers.push(
    GitHubProvider({
      clientId: env.github.clientId,
      clientSecret: env.github.clientSecret,
    })
  );
}

if (isAuthProviderEnabled('google')) {
  providers.push(
    GoogleProvider({
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
    })
  );
}

if (isAuthProviderEnabled('email')) {
  providers.push(
    EmailProvider({
      server: {
        host: env.smtp.host,
        port: env.smtp.port,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.password,
        },
      },
      from: env.smtp.from,
      sendVerificationRequest: sendMagicLink,
      maxAge: 1 * 60 * 60,
    })
  );
}

if (isAuthProviderEnabled('saml')) {
  providers.push(
    BoxyHQSAMLProvider({
      authorization: { params: { scope: '' } },
      issuer: env.appUrl,
      clientId: 'dummy',
      clientSecret: 'dummy',
    })
  );
}

export const isCredentialsProviderCallback = (req: NextApiRequest | GetServerSidePropsContext['req']) => {
  if (req.method !== 'POST') return false;
  const url = req.url || '';
  return url.startsWith('/api/auth/callback/credentials');
};

const isCredentialsProviderCallbackWithDbSession = (
  req: NextApiRequest | GetServerSidePropsContext['req']
) => {
  return (
    isCredentialsProviderCallback(req) &&
    env.nextAuth.sessionStrategy === 'database'
  );
};

const createDatabaseSession = async (
  user: User,
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
) => {
  // rememberMe에 따라 만료 시간 결정
  const body = (req as any).body || {};
  const rememberMe = body.rememberMe === '1';
  const maxAge = rememberMe ? SESSION_MAXAGE_REMEMBER : SESSION_MAXAGE_SESSION;

  const sessionToken = randomUUID();
  const sessionExpiry = new Date(Date.now() + maxAge * 1000);

  await adapter.createSession!({
    sessionToken,
    userId: user.id,
    expires: sessionExpiry,
  });

  setCookie(sessionTokenCookieName, sessionToken, {
    req,
    res,
    expires: rememberMe ? sessionExpiry : undefined, // 미체크 시 세션쿠키(브라우저 종료시 삭제)
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecureCookie,
  });
};

export const getAuthOptions: (
  req: NextApiRequest | GetServerSidePropsContext['req'],
  res: NextApiResponse | GetServerSidePropsContext['res']
) => NextAuthOptions = (req, res) => ({
  adapter,
  providers,
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
    verifyRequest: '/auth/magic-link',
  },
  session: {
    strategy: env.nextAuth.sessionStrategy,
    maxAge: SESSION_MAXAGE_REMEMBER,
  },
  secret: env.nextAuth.secret,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') {
        if (isCredentialsProviderCallbackWithDbSession(req)) {
          await createDatabaseSession(user, req, res);
        }
        return true;
      }

      if (!user || !user.email || !account) {
        return false;
      }

      if (!isEmailAllowed(user.email)) {
        return '/auth/login?error=allow-only-work-email';
      }

      const existingUser = await getUser({ email: user.email });
      const isIdpLogin = account.provider === 'boxyhq-idp';

      if (isCredentialsProviderCallbackWithDbSession(req) && !isIdpLogin) {
        await createDatabaseSession(user, req, res);
      }

      if (account?.provider === 'email') {
        return Boolean(existingUser);
      }

      if (!existingUser) {
        const newUser = await createUser({
          name: `${user.name}`,
          email: `${user.email}`,
        });

        await linkAccount(newUser, account);

        if (isIdpLogin && user) {
          await linkToTeam(user as unknown as Profile, newUser.id);
        }

        if (account.provider === 'boxyhq-saml' && (user as any).profile) {
          await linkToTeam((user as any).profile, newUser.id);
        }

        slackNotify()?.alert({
          text: 'New user signed up',
          fields: { Email: user.email || '', Name: user.name || '' },
        });
      } else {
        if (isIdpLogin && user) {
          await linkToTeam(user as unknown as Profile, existingUser.id);
        }
      }

      return true;
    },

    async session({ session, token }) {
      if (token && session) {
        session.user = {
          ...session.user,
          id: token.sub as string,
        };
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  jwt: {
    encode: async ({ secret, token, maxAge }) => {
      const body = (req as any).body || {};
      const rememberMe = body.rememberMe === '1';
      const effectiveMaxAge = rememberMe ? SESSION_MAXAGE_REMEMBER : SESSION_MAXAGE_SESSION;

      if (isCredentialsProviderCallbackWithDbSession(req)) {
        const cookie = getCookie(sessionTokenCookieName, { req, res });
        if (cookie) return cookie as string;
        return '';
      }
      return encode({ secret, token, maxAge: effectiveMaxAge });
    },
    decode: async ({ secret, token }) => {
      if (isCredentialsProviderCallbackWithDbSession(req)) {
        return null;
      }
      return decode({ secret, token });
    },
  },
});

async function linkAccount(user: { id: string }, account: Account) {
  return await getAccount({ userId: user.id }).then(async (existingAccount) => {
    if (!existingAccount) {
      return prisma.account.create({
        data: {
          userId: user.id,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          id_token: account.id_token,
          token_type: account.token_type,
          scope: account.scope,
          expires_at: account.expires_at,
        },
      });
    }
  });
}

async function linkToTeam(profile: Profile, userId: string) {
  const team = await getTeam({ id: (profile as any)?.requested?.tenant });
  if (team) {
    const existingMember = await prisma.teamMember.findFirst({
      where: { teamId: team.id, userId },
    });
    if (!existingMember) {
      await addTeamMember(team.id, userId, team.defaultRole as Role);
    }
  }
}

export async function forceConsumeAsync(req: NextApiRequest | GetServerSidePropsContext['req']) {
  return forceConsume(req);
}
