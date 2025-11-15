/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        "falcon-orange": "#f26522",
        "falcon-brown": "#4b2e2b",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        falcon: {
          primary: "#f26522",
          secondary: "#775b59",
          accent: "#3aafa9",
          neutral: "#2f2f2f",
          "base-100": "#f9fafb",
          info: "#60a5fa",
          success: "#34d399",
          warning: "#facc15",
          error: "#f87171",
        },
      },
      {
        falconDark: {
          primary: "#f5904f",
          secondary: "#d9b5ab",
          accent: "#64d8d1",
          neutral: "#0f172a",
          "base-100": "#0b1120",
          "base-200": "#111827",
          "base-300": "#1f2937",
          info: "#38bdf8",
          success: "#34d399",
          warning: "#fbbf24",
          error: "#f87171",
        },
      },
    ],
    darkTheme: "falconDark",
  },
};
