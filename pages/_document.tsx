import { Html, Head, Main, NextScript } from 'next/document';

// Script to set theme before React hydrates (prevents flash)
const themeScript = `
(function() {
  try {
    var mode = localStorage.getItem('gantt-theme') || 'system';
    var theme = mode;
    if (mode === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
