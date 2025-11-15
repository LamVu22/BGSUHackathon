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
      "corporate",
    ],
    darkTheme: "corporate",
  },
};
