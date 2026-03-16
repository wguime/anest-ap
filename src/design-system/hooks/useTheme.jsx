// Design System ANEST - useTheme Hook + ThemeProvider
// Gerenciamento de tema com Context para re-render global

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';

// ============================================================================
// TOKENS DO DESIGN SYSTEM ANEST (de Tokens.json)
// ============================================================================

const TOKENS = {
  colors: {
    light: {
      background: {
        primary: "#F0FFF4",
        card: "#FFFFFF",
        cardHighlight: "#D4EDDA",
        cardAccent: "#C8E6C9"
      },
      green: {
        darkest: "#002215",
        dark: "#004225",
        medium: "#006837",
        bright: "#2E8B57",
        light: "#9BC53D"
      },
      text: {
        primary: "#000000",
        secondary: "#6B7280",
        muted: "#9CA3AF"
      },
      border: {
        default: "#C8E6C9",
        divider: "#F3F4F6"
      },
      status: {
        error: "#DC2626",
        warning: "#F59E0B",
        success: "#34C759"
      }
    },
    dark: {
      background: {
        primary: "#111916",
        darkest: "#0A0F0D",
        card: "#1A2420",
        cardHover: "#212D28",
        cardLight: "#243530"
      },
      green: {
        primary: "#2ECC71",
        light: "#58D68D",
        muted: "#1E8449",
        dark: "#145A32",
        glow: "rgba(46, 204, 113, 0.15)"
      },
      text: {
        primary: "#FFFFFF",
        secondary: "#A3B8B0",
        muted: "#6B8178"
      },
      border: {
        default: "#2A3F36",
        light: "#344840"
      },
      status: {
        error: "#E74C3C",
        errorGlow: "rgba(231, 76, 60, 0.2)",
        warning: "#F39C12",
        success: "#2ECC71"
      }
    }
  },

  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    scale: {
      greeting: { fontSize: "20px", fontWeight: 700 },
      cardTitle: { fontSize: "20px", fontWeight: 700 },
      sectionTitle: { fontSize: "18px", fontWeight: 700 },
      widgetTitle: { fontSize: "16px", fontWeight: 700 },
      body: { fontSize: "15px", fontWeight: 600 },
      bodyLight: { fontSize: "14px", fontWeight: 500 },
      caption: { fontSize: "13px", fontWeight: 500 },
      captionBold: { fontSize: "13px", fontWeight: 600 },
      label: { fontSize: "12px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" },
      badge: { fontSize: "11px", fontWeight: 600 },
      badgeBold: { fontSize: "11px", fontWeight: 700 },
      micro: { fontSize: "10px", fontWeight: 500 }
    }
  },

  spacing: {
    base: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "20px",
      xxl: "24px"
    },
    layout: {
      pageHorizontal: "20px",
      pageTop: "24px",
      pageBottom: "100px",
      cardPadding: "20px",
      cardGap: "16px",
      headerMarginBottom: "24px",
      searchMarginBottom: "24px",
      listItemPadding: "14px 0",
      listItemGap: "14px",
      bottomNavPadding: "6px 40px 12px"
    }
  },

  borderRadius: {
    badge: "10px",
    badgePill: "11px",
    icon: "12px",
    search: "16px",
    card: "20px",
    avatar: "50%",
    phoneFrame: "48px",
    phoneScreen: "40px"
  },

  shadows: {
    light: {
      card: "0 2px 12px rgba(0,66,37,0.06)",
      cardHighlight: "0 2px 12px rgba(0,66,37,0.08)",
      bell: "0 2px 8px rgba(0,66,37,0.1)",
      avatar: "0 4px 16px rgba(0,66,37,0.3)",
      atalhoDefault: "0 4px 12px rgba(0,66,37,0.25)",
      atalhoDestaque: "0 6px 16px rgba(0,66,37,0.4)",
      phoneFrame: "0 30px 60px rgba(0,66,37,0.4)"
    },
    dark: {
      card: "none",
      bell: "0 4px 12px rgba(0,0,0,0.3)",
      avatar: "0 4px 20px rgba(46, 204, 113, 0.4)",
      atalhoDefault: "0 4px 12px rgba(0,0,0,0.3)",
      atalhoDestaque: "0 6px 20px rgba(46, 204, 113, 0.4)",
      textGlow: "0 0 10px rgba(46, 204, 113, 0.15)",
      badgeGlow: "0 0 10px rgba(231, 76, 60, 0.2)",
      bulletGlow: "0 0 6px #2ECC71",
      phoneFrame: "0 30px 60px rgba(0,0,0,0.8)"
    }
  },

  components: {
    avatar: {
      sizes: {
        sm: { size: "32px", fontSize: "12px" },
        md: { size: "44px", fontSize: "16px" },
        lg: { size: "52px", fontSize: "19px" },
        xl: { size: "80px", fontSize: "28px" }
      }
    },
    bell: { size: "44px" },
    badge: { minWidth: "22px", height: "22px" },
    atalho: { circle: "54px", container: "70px" },
    listIcon: { size: "48px" },
    navIcon: { size: "28px" },
    searchIcon: { size: "22px" }
  },

  animations: {
    keyframes: {
      shimmer: "background-position 200% 0 → -200% 0",
      fadeIn: "opacity 0 → 1, translateY 10px → 0",
      glow: "box-shadow pulsing green"
    },
    transitions: {
      fast: "0.15s ease",
      normal: "0.2s ease",
      slow: "0.4s ease"
    },
    classes: {
      fadeIn: "animation: fadeIn 0.4s ease forwards",
      cardPress: "transition: transform 0.15s ease; :active scale(0.97)"
    }
  }
};

// ============================================================================
// CONSTANTES
// ============================================================================

const STORAGE_KEY = 'anest-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSystemPreference() {
  if (typeof window === 'undefined') {
    return THEMES.LIGHT;
  }
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? THEMES.DARK
    : THEMES.LIGHT;
}

function getStoredTheme() {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === THEMES.LIGHT || stored === THEMES.DARK) {
      return stored;
    }
    return null;
  } catch (error) {
    console.warn('[useTheme] Erro ao acessar localStorage:', error);
    return null;
  }
}

function saveTheme(theme) {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (error) {
    console.warn('[useTheme] Erro ao salvar no localStorage:', error);
  }
}

function getInitialTheme() {
  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }
  return getSystemPreference();
}

function applyThemeToDocument(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }
}

// ============================================================================
// THEME CONTEXT
// ============================================================================

const ThemeContext = createContext(null);

/**
 * ThemeProvider - Wrapper que fornece o estado de tema para toda a aplicação
 * 
 * @example
 * // No main.jsx ou App.jsx:
 * import { ThemeProvider } from '@/design-system';
 * 
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') {
      return THEMES.LIGHT;
    }
    return getInitialTheme();
  });

  // Aplica tema no documento quando muda
  useEffect(() => {
    saveTheme(theme);
    applyThemeToDocument(theme);
  }, [theme]);

  // Detecta mudanças na preferência do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (event) => {
      const stored = getStoredTheme();
      if (!stored) {
        setThemeState(event.matches ? THEMES.DARK : THEMES.LIGHT);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme === THEMES.LIGHT || newTheme === THEMES.DARK) {
      setThemeState(newTheme);
    } else {
      console.warn(`[useTheme] Tema inválido: "${newTheme}". Use "light" ou "dark".`);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => 
      current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    );
  }, []);

  const isDark = theme === THEMES.DARK;

  const colors = useMemo(() => {
    return isDark ? TOKENS.colors.dark : TOKENS.colors.light;
  }, [isDark]);

  const shadows = useMemo(() => {
    return isDark ? TOKENS.shadows.dark : TOKENS.shadows.light;
  }, [isDark]);

  const typography = useMemo(() => ({
    fontFamily: TOKENS.typography.fontFamily,
    ...TOKENS.typography.scale
  }), []);

  const spacing = useMemo(() => TOKENS.spacing, []);
  const borderRadius = useMemo(() => TOKENS.borderRadius, []);
  const components = useMemo(() => TOKENS.components, []);
  const animations = useMemo(() => TOKENS.animations, []);

  const value = useMemo(() => ({
    isDark,
    theme,
    toggleTheme,
    setTheme,
    colors,
    shadows,
    typography,
    spacing,
    borderRadius,
    components,
    animations,
    tokens: TOKENS
  }), [isDark, theme, toggleTheme, setTheme, colors, shadows, typography, spacing, borderRadius, components, animations]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// HOOK useTheme
// ============================================================================

/**
 * Hook para gerenciamento de tema no ANEST Design System
 * 
 * IMPORTANTE: Requer ThemeProvider como ancestral na árvore de componentes.
 * 
 * @example
 * const { isDark, colors, toggleTheme, typography } = useTheme();
 * 
 * <div style={{ background: colors.background.primary }}>
 *   <h1 style={{ color: colors.text.primary }}>Olá</h1>
 * </div>
 * 
 * <button onClick={toggleTheme}>
 *   {isDark ? '☀️' : '🌙'}
 * </button>
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === null) {
    throw new Error(
      '[useTheme] Hook chamado fora do ThemeProvider. ' +
      'Envolva sua aplicação com <ThemeProvider> no main.jsx ou App.jsx.'
    );
  }
  
  return context;
}

export default useTheme;
