import { useEffect, useState } from "react";
import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "falcon";
    }
    return "falcon";
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme && savedTheme !== theme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "falcon" ? "falconDark" : "falcon"));
  };

  return (
    <main data-theme={theme}>
      <Component {...pageProps} theme={theme} toggleTheme={toggleTheme} />
    </main>
  );
}

export default MyApp;
