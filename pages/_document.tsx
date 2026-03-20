import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ko" className="h-full" data-theme="black">
      <Head>
        {/* Pretendard 폰트 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* PWA 메타 */}
        <meta name="application-name" content="LOOKUP9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LOOKUP9" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#09090B" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F8FAFC" media="(prefers-color-scheme: light)" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>
      <body className="h-full">
        {/* 테마 깜빡임 방지: 렌더 전에 localStorage 읽어서 즉시 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var t = localStorage.getItem('theme');
    var theme = (t === 'light') ? 'corporate' : 'black';
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'black') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e) {}
})();
            `.trim(),
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
