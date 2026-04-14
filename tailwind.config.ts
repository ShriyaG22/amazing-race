import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#141420",
        card: "#1a1a2e",
        border: "#2a2a44",
        accent: "#f5a623",
        "accent-dim": "#c4841c",
        danger: "#e74c5e",
        success: "#2ecc71",
        info: "#3b82f6",
        purple: "#9b59b6",
        cyan: "#00d2d3",
        "text-primary": "#e8e6f0",
        "text-dim": "#8888a8",
        "text-muted": "#555570",
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
