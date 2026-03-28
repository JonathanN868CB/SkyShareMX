import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        "popover-border": "hsl(var(--popover-border))",
        sidebar: {
          bg: "hsl(var(--sidebar-bg))",
          foreground: "hsl(var(--sidebar-foreground))",
          hover: "hsl(var(--sidebar-hover))",
          "active-bg": "hsl(var(--sidebar-active-bg))",
          "active-text": "hsl(var(--sidebar-active-text))",
          border: "hsl(var(--sidebar-border))",
          label: "hsl(var(--sidebar-label))",
        },
        topbar: {
          bg: "hsl(var(--topbar-bg))",
          border: "hsl(var(--topbar-border))",
        },
        skyshare: {
          red: "var(--skyshare-red)",
          "red-light": "var(--skyshare-red-light)",
          crimson: "var(--skyshare-crimson)",
          grey: "var(--skyshare-grey)",
          "grey-light": "var(--skyshare-grey-light)",
          "grey-dark": "var(--skyshare-grey-dark)",
          black: "var(--skyshare-black)",
          navy: "var(--skyshare-navy)",
          blue: "var(--skyshare-blue)",
          "blue-mid": "var(--skyshare-blue-mid)",
          "blue-light": "var(--skyshare-blue-light)",
          gold: "var(--skyshare-gold)",
          "gold-light": "var(--skyshare-gold-light)",
          success: "var(--skyshare-success)",
          warning: "var(--skyshare-warning)",
        },
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animatePlugin],
} satisfies Config;
