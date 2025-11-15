import { useEffect, useState } from "react";
import "../styles/globals.css";

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "falcon";
  }
  const stored = localStorage.getItem("theme");
  const domTheme = document.documentElement.getAttribute("data-theme");
  return stored || domTheme || "falcon";
};

function MyApp({ Component, pageProps }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.style.backgroundColor = theme === "falconDark" ? "#0b1120" : "#f9fafb";
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "falcon" ? "falconDark" : "falcon"));
  };

  return (
    <main>
      <Component {...pageProps} theme={theme} toggleTheme={toggleTheme} />
    </main>
  );
}

export default MyApp;
