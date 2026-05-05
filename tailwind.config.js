import animate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // Breakpoints oficiais do projeto (min-width)
    // Base (sem prefixo) = xs (< 480px)
    screens: {
      sm: "480px",
      md: "640px",
      lg: "768px",
      xl: "1024px",
      "2xl": "1440px",
    },
    container: {
      center: true,
      padding: "0", // Pages controlam padding via px-4 sm:px-5
      screens: {
        // Container max-width (tokens)
        lg: "720px",
        xl: "960px",
        "2xl": "1200px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
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
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          surface: "hsl(var(--card-surface))",
          elevated: "hsl(var(--card-elevated))",
          highlight: "hsl(var(--card-highlight))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // Verdes institucionais (Tokens.json > colors.light.green)
        greenDarkest: "#002215",
        greenDark: "#004225",
        greenMedium: "#006837",
        greenBright: "#2E8B57",
        greenLight: "#9BC53D",
        "category-purple": {
          DEFAULT: "hsl(var(--category-purple))",
          foreground: "hsl(var(--category-purple-foreground))",
          bg: "hsl(var(--category-purple-bg))",
          fg: "hsl(var(--category-purple-fg))",
        },
        "category-cyan": {
          DEFAULT: "hsl(var(--category-cyan))",
          foreground: "hsl(var(--category-cyan-foreground))",
          bg: "hsl(var(--category-cyan-bg))",
          fg: "hsl(var(--category-cyan-fg))",
        },
        "category-pink": {
          DEFAULT: "hsl(var(--category-pink))",
          foreground: "hsl(var(--category-pink-foreground))",
          bg: "hsl(var(--category-pink-bg))",
          fg: "hsl(var(--category-pink-fg))",
        },
        "category-indigo": {
          DEFAULT: "hsl(var(--category-indigo))",
          foreground: "hsl(var(--category-indigo-foreground))",
          bg: "hsl(var(--category-indigo-bg))",
          fg: "hsl(var(--category-indigo-fg))",
        },
        "category-blue": {
          DEFAULT: "hsl(var(--category-blue))",
          foreground: "hsl(var(--category-blue-foreground))",
          bg: "hsl(var(--category-blue-bg))",
          fg: "hsl(var(--category-blue-fg))",
        },
        "category-orange": {
          DEFAULT: "hsl(var(--category-orange))",
          foreground: "hsl(var(--category-orange-foreground))",
          bg: "hsl(var(--category-orange-bg))",
          fg: "hsl(var(--category-orange-fg))",
        },
        "category-teal": {
          DEFAULT: "hsl(var(--category-teal))",
          foreground: "hsl(var(--category-teal-foreground))",
          bg: "hsl(var(--category-teal-bg))",
          fg: "hsl(var(--category-teal-fg))",
        },
        "category-red": {
          bg: "hsl(var(--category-red-bg))",
          fg: "hsl(var(--category-red-fg))",
        },
        "category-green": {
          bg: "hsl(var(--category-green-bg))",
          fg: "hsl(var(--category-green-fg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      minHeight: {
        touch: "44px",
        "touch-comfortable": "48px",
        screen: "100dvh",
      },
      height: {
        screen: "100dvh",
      },
      minWidth: {
        touch: "44px",
        "touch-comfortable": "48px",
      },
      // W2-3 — Tipografia mínima interativa (13px)
      // Use `text-interactive` em badges/pills/links clicáveis para garantir
      // legibilidade WCAG (substitui ad-hoc text-[10px] / text-[11px]).
      fontSize: {
        interactive: ["13px", { lineHeight: "1.3", fontWeight: "500" }],
        "interactive-bold": ["13px", { lineHeight: "1.3", fontWeight: "600" }],
      },
      // W2-3 — Default ring color resolves to design-system --ring
      ringColor: {
        DEFAULT: "hsl(var(--ring))",
      },
      ringOffsetColor: {
        DEFAULT: "hsl(var(--background))",
      },
    },
  },
  plugins: [animate],
}


