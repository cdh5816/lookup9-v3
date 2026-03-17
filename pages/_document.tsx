import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ko" className="h-full" data-theme="black">
      <Head />
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
