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
      // Typography scale do DS — espelha Tokens.json > typography.scale
      // Cada token aplica fontSize + lineHeight + letterSpacing + fontWeight juntos.
      // Tailwind defaults (text-xs/sm/base/lg/xl/2xl) continuam disponíveis.
      fontSize: {
        greeting:        ['20px', { lineHeight: '1.3',  letterSpacing: '-0.4px', fontWeight: '700' }],
        "card-title":    ['20px', { lineHeight: '1.3',  letterSpacing: '-0.4px', fontWeight: '700' }],
        "section-title": ['18px', { lineHeight: '1.35', letterSpacing: '-0.3px', fontWeight: '700' }],
        "widget-title":  ['16px', { lineHeight: '1.4',  letterSpacing: '-0.2px', fontWeight: '700' }],
        "body-md":       ['15px', { lineHeight: '1.5',  letterSpacing: '0',      fontWeight: '600' }],
        "body-sm":       ['14px', { lineHeight: '1.5',  letterSpacing: '0',      fontWeight: '500' }],
        caption:         ['13px', { lineHeight: '1.45', letterSpacing: '0',      fontWeight: '500' }],
        "caption-bold":  ['13px', { lineHeight: '1.45', letterSpacing: '0',      fontWeight: '600' }],
        "label-ds":      ['12px', { lineHeight: '1.3',  letterSpacing: '0.5px',  fontWeight: '500' }],
        "badge-ds":      ['11px', { lineHeight: '1.2',  letterSpacing: '0',      fontWeight: '600' }],
        // Aliases mais curtos (uso recomendado em código novo):
        // text-label  → label uppercase + tracking 0.5px (use cap labels)
        // text-badge  → texto de badge (11px medium)
        label:           ['12px', { lineHeight: '1.3',  letterSpacing: '0.5px',  fontWeight: '500' }],
        badge:           ['11px', { lineHeight: '1.2',  letterSpacing: '0',      fontWeight: '600' }],
        "badge-bold":    ['11px', { lineHeight: '1.2',  letterSpacing: '0',      fontWeight: '700' }],
        micro:           ['10px', { lineHeight: '1.3',  letterSpacing: '0',      fontWeight: '500' }],
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
        // Organograma — cores fiéis ao PDF (hex em var(), sem hsl wrapper). Ver anest-theme.css.
        "org-governance": { bg: "var(--org-governance-bg)", hover: "var(--org-governance-hover)", border: "var(--org-governance-border)", text: "var(--org-governance-text)", icon: "var(--org-governance-icon)", accent: "var(--org-governance-accent)" },
        "org-executive": { bg: "var(--org-executive-bg)", hover: "var(--org-executive-hover)", border: "var(--org-executive-border)", text: "var(--org-executive-text)", icon: "var(--org-executive-icon)", accent: "var(--org-executive-accent)" },
        "org-technical": { bg: "var(--org-technical-bg)", hover: "var(--org-technical-hover)", border: "var(--org-technical-border)", text: "var(--org-technical-text)", icon: "var(--org-technical-icon)", accent: "var(--org-technical-accent)" },
        "org-admin": { bg: "var(--org-admin-bg)", hover: "var(--org-admin-hover)", border: "var(--org-admin-border)", text: "var(--org-admin-text)", icon: "var(--org-admin-icon)", accent: "var(--org-admin-accent)" },
        "org-committee": { bg: "var(--org-committee-bg)", hover: "var(--org-committee-hover)", border: "var(--org-committee-border)", text: "var(--org-committee-text)", icon: "var(--org-committee-icon)", accent: "var(--org-committee-accent)" },
        "org-operational": { bg: "var(--org-operational-bg)", hover: "var(--org-operational-hover)", border: "var(--org-operational-border)", text: "var(--org-operational-text)", icon: "var(--org-operational-icon)", accent: "var(--org-operational-accent)" },
        "org-advisory": { bg: "var(--org-advisory-bg)", hover: "var(--org-advisory-hover)", border: "var(--org-advisory-border)", text: "var(--org-advisory-text)", icon: "var(--org-advisory-icon)", accent: "var(--org-advisory-accent)" },
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
      // Shadow elevation ladder (Material 3 style, identity preserved)
      // Light: green-tinted shadows. Dark: neutral black shadows.
      boxShadow: {
        "elevation-1": "var(--elevation-1)",
        "elevation-2": "var(--elevation-2)",
        "elevation-3": "var(--elevation-3)",
        "elevation-4": "var(--elevation-4)",
        "elevation-5": "var(--elevation-5)",
      },
      // Z-index scale documentado (espelha Tokens.json > zIndex)
      zIndex: {
        nav: "var(--z-nav)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        header: "var(--z-header)",
        modal: "var(--z-modal)",
        submodal: "var(--z-submodal)",
        select: "var(--z-select)",
        toast: "var(--z-toast)",
        popover: "var(--z-popover)",
        "skip-link": "var(--z-skip-link)",
        overlay: "var(--z-overlay)",
      },
    },
  },
  plugins: [animate],
}


