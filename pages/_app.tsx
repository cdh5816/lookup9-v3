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
    if (env.darkModeEnabled) {
      applyTheme(localStorage.getItem('theme') as Theme);
    }
  }, []);

  const getLayout =
    Component.getLayout || ((page) => <AppShell>{page}</AppShell>);

  return (
    <>
      <Head>
        <title>{app.name}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SessionProvider session={session}>
        <Toaster toastOptions={{ duration: 4000 }} />
        {getLayout(<Component {...props} />)}
      </SessionProvider>
    </>
  );
}

export default appWithTranslation<never>(MyApp);
