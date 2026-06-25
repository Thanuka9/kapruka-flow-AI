import Head from "next/head";
import "../styles/globals.css";
import ErrorBoundary from "../components/ErrorBoundary";

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#c70101" />
        <meta
          name="description"
          content="Tell me what you need. I'll build the cart. Search Kapruka products, add to cart, set delivery and gift message, then checkout."
        />
        <meta name="application-name" content="Kapruka Flow" />
        <meta property="og:title" content="Kapruka Flow — AI Shopping Experience" />
        <meta
          property="og:description"
          content="Tell me what you need. I'll build the cart — powered by the live Kapruka MCP catalog."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="https://www.kapruka.com/favicon.ico" />
        <link rel="preconnect" href="https://www.kapruka.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
        <title>Kapruka Flow — AI Shopping Experience</title>
      </Head>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
