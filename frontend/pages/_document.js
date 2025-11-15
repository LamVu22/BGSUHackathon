import { Html, Head, Main, NextScript } from "next/document";

const setInitialTheme = `
(function() {
  try {
    var stored = window.localStorage.getItem('theme');
    var theme = stored || 'falcon';
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    var bg = theme === 'falconDark' ? '#0b1120' : '#f9fafb';
    root.style.backgroundColor = bg;
    var applyBodyBg = function() { document.body && (document.body.style.backgroundColor = bg); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyBodyBg);
    } else {
      applyBodyBg();
    }
  } catch (err) {
    document.documentElement.setAttribute('data-theme', 'falcon');
    document.documentElement.style.backgroundColor = '#f9fafb';
  }
})();
`;

export default function Document() {
  return (
    <Html data-theme="falcon">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: setInitialTheme }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
