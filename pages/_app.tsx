import app from '@/lib/app';
import { SessionProvider } from 'next-auth/react';
import { appWithTranslation } from 'next-i18next';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import type { AppPropsWithLayout } from 'types';

import '@boxyhq/react-ui/dist/react-ui.css';
import '../styles/globals.css';
import { useEffect } from 'react';
import env from '@/lib/env';
import { Theme, applyTheme } from '@/lib/theme';
import AppShell from '@/components/shared/shell/AppShell';

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const { session, ...props } = pageProps;

  useEffect(() => {
    // 저장된 테마 적용 (없으면 dark 기본)
    const saved = localStorage.getItem('theme') as Theme;
    applyTheme(saved || 'dark');
  }, []);

  const getLayout =
    Component.getLayout || ((page) => <AppShell>{page}</AppShell>);

  return (
    <>
      <Head>
        <title>{app.name}</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="현장관리, 생산, 출하, 공정률 실시간 확인 — LOOKUP9 시공관리 플랫폼" />
        <meta property="og:title" content="LOOKUP9 — 시공관리 플랫폼" />
        <meta property="og:description" content="영업부터 준공까지, 올인원 현장관리 시스템" />
        <meta property="og:image" content="https://lookup9.com/og-image.png" />
        <meta property="og:url" content="https://lookup9.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="LOOKUP9" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <SessionProvider session={session}>
        <Toaster toastOptions={{ duration: 4000 }} />
        {getLayout(<Component {...props} />)}
      </SessionProvider>
    </>
  );
}

export default appWithTranslation<never>(MyApp);
