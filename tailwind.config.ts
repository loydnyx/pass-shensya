import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--paper)",
          light: "var(--paper-light)",
          dark: "var(--paper-dark)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          charcoal: "var(--charcoal)",
          muted: "var(--muted)",
          faded: "var(--faded)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          dark: "var(--accent-dark)",
        },
        rule: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        newsprint:
          "radial-gradient(circle at 1px 1px, rgba(23,23,23,0.05) 1px, transparent 0)",
      },
      backgroundSize: {
        newsprint: "4px 4px",
      },
    },
  },
  plugins: [],
};

export default config;