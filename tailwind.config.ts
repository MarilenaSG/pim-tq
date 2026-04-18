import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // TQ Brand palette — TeQuiero_ManualIdentidadVisual_v4
        tq: {
          snorkel:       "#00557f", // PANTONE 19-4049 TCX · Primary dark
          sky:           "#0099f2", // PANTONE 2193 C · Primary bright
          alyssum:       "#e8e3df", // PANTONE 11-1001 TCX · Warm cream
          gold:          "#c8a164", // PANTONE 7562 C · Jewelry accent
          ink:           "#1d1d1b",
          "gray-400":    "#b2b2b2",
          "gray-300":    "#c6c6c6",
          "bg-elevated": "#f4f1ee",
        },
        // Semantic status
        status: {
          ok:    "#3A9E6A",
          warn:  "#C8842A",
          error: "#C0392B",
          info:  "#2A5F9E",
        },
      },
      fontFamily: {
        display: ["var(--font-zodiak)", "Georgia", "Times New Roman", "serif"],
        body:    ["var(--font-poppins)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,32,60,0.06)",
        sm: "0 2px 6px rgba(0,32,60,0.08)",
        md: "0 8px 20px rgba(0,32,60,0.10)",
        lg: "0 20px 40px rgba(0,32,60,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
