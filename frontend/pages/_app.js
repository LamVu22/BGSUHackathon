import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  return (
    <main data-theme="falcon">
      <Component {...pageProps} />
    </main>
  );
}

export default MyApp;
