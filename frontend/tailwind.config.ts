import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0d1117",
        "bg-secondary": "#1a1a2e",
        "accent-yellow": "#ecad0a",
        "accent-blue": "#209dd7",
        "accent-purple": "#753991",
      },
    },
  },
  plugins: [],
};

export default config;
