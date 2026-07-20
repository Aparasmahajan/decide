import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f5f6ff",
          100: "#e6e8ff",
          200: "#c4c8ff",
          300: "#9ba0ff",
          400: "#6d73f5",
          500: "#4a4fe0",
          600: "#3538b8",
          700: "#25278a",
          800: "#161760",
          900: "#0a0b3a",
          950: "#04051f",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "Inter",
          "SF Pro Display",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
      },
      backgroundImage: {
        "aurora-1":
          "radial-gradient(at 20% 20%, rgba(139,92,246,0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(56,189,248,0.35) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(236,72,153,0.30) 0px, transparent 50%), radial-gradient(at 20% 100%, rgba(34,197,94,0.25) 0px, transparent 50%)",
        "grid-fade":
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 60%)",
        "shine":
          "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(139,92,246,0.35), 0 0 80px rgba(56,189,248,0.15)",
        "glow-lg":
          "0 0 60px rgba(139,92,246,0.5), 0 0 120px rgba(56,189,248,0.25)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.08)",
        "soft-lg":
          "0 30px 60px -20px rgba(0,0,0,0.5), 0 18px 36px -18px rgba(0,0,0,0.4)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(1deg)" },
        },
        drift: {
          "0%": { transform: "translate(0,0)" },
          "50%": { transform: "translate(20px, -30px)" },
          "100%": { transform: "translate(0,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        aurora: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(30px,-20px) scale(1.05)" },
          "66%": { transform: "translate(-20px,20px) scale(0.95)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        pulseGlow: "pulseGlow 3s ease-in-out infinite",
        aurora: "aurora 20s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
