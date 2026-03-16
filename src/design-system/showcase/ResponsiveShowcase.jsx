// ResponsiveShowcase.jsx
// Demonstração de responsividade (breakpoints, grid/stack, show/hide, touch targets, safe-area)

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { useTheme } from "../hooks/useTheme.jsx"
import { useBreakpoint, useIOSDevice } from "../hooks/useMediaQuery.jsx"

import { Button } from "../components/ui/button"
import {
  DesktopOnly,
  MobileOnly,
  ResponsiveGrid,
  ResponsiveStack,
  TabletOnly,
} from "../components/ui/responsive-container"

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }))

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight })
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return size
}

function useSafeAreaVars() {
  const [vars, setVars] = useState({
    top: "0px",
    bottom: "0px",
    left: "0px",
    right: "0px",
  })

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return

    const read = () => {
      const s = window.getComputedStyle(document.documentElement)
      setVars({
        top: s.getPropertyValue("--safe-area-top").trim() || "0px",
        bottom: s.getPropertyValue("--safe-area-bottom").trim() || "0px",
        left: s.getPropertyValue("--safe-area-left").trim() || "0px",
        right: s.getPropertyValue("--safe-area-right").trim() || "0px",
      })
    }

    read()
    window.addEventListener("resize", read)
    window.addEventListener("orientationchange", read)
    return () => {
      window.removeEventListener("resize", read)
      window.removeEventListener("orientationchange", read)
    }
  }, [])

  return vars
}

function ShowcaseSection({ title, description, children }) {
  const { isDark } = useTheme()

  return (
    <div style={{ marginBottom: "32px" }}>
      <h3
        style={{
          fontSize: "18px",
          fontWeight: 700,
          marginBottom: "8px",
          color: isDark ? "#FFFFFF" : "#000000",
        }}
      >
        {title}
      </h3>
      {description ? (
        <p
          style={{
            fontSize: "14px",
            color: isDark ? "#A3B8B0" : "#6B7280",
            marginBottom: "16px",
          }}
        >
          {description}
        </p>
      ) : null}
      <div
        className="p-4 md:p-6 rounded-xl md:rounded-2xl overflow-hidden"
        style={{
          background: isDark ? "#1A2420" : "#E8F5E9",
          border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Pill({ children, tone = "default" }) {
  const { isDark } = useTheme()
  const bg =
    tone === "success"
      ? isDark
        ? "rgba(46, 204, 113, 0.16)"
        : "rgba(0, 104, 55, 0.12)"
      : isDark
      ? "#243530"
      : "#D4EDDA"
  const fg =
    tone === "success"
      ? isDark
        ? "#2ECC71"
        : "#004225"
      : isDark
      ? "#A3B8B0"
      : "#374151"

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: "999px",
        background: bg,
        color: fg,
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  )
}

function MeasureButton({ label, size, tone }) {
  const ref = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      setDims({ w: Math.round(r.width), h: Math.round(r.height) })
    }
    read()
    window.addEventListener("resize", read)
    return () => window.removeEventListener("resize", read)
  }, [])

  const ok = dims.h >= 44

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button ref={ref} size={size} variant={tone}>
          {label}
        </Button>
        <Pill tone={ok ? "success" : "default"}>
          {dims.w}×{dims.h}px {ok ? "(OK ≥ 44px)" : "(Ajustar)"}
        </Pill>
      </div>
      <div
        className="h-11 rounded-xl border border-dashed flex items-center justify-center text-xs"
        style={{
          borderColor: "rgba(156, 163, 175, 0.7)",
          color: "rgba(156, 163, 175, 1)",
        }}
      >
        Guia visual: 44px de altura
      </div>
    </div>
  )
}

export function ResponsiveShowcase() {
  const { isDark } = useTheme()
  const bp = useBreakpoint()
  const ios = useIOSDevice()
  const viewport = useViewportSize()
  const safeArea = useSafeAreaVars()

  const deviceLabel = useMemo(() => {
    if (bp.isMobile) return "Mobile"
    if (bp.isTablet) return "Tablet"
    return "Desktop"
  }, [bp.isMobile, bp.isTablet])

  const cardBg = (i) =>
    isDark
      ? ["#243530", "#1E3A2F", "#1F2D29", "#213731", "#1A2A24"][i % 5]
      : ["#F0FFF4", "#D4EDDA", "#ECFDF5", "#EFF6FF", "#C8E6C9"][i % 5]

  return (
    <div
      className="px-3 sm:px-4 md:px-6 py-4 md:py-6 w-full"
      style={{
        background: isDark ? "#111916" : "#F0FFF4",
        minHeight: "100vh",
        color: isDark ? "#FFFFFF" : "#000000",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 800,
          marginBottom: "8px",
          color: isDark ? "#FFFFFF" : "#000000",
        }}
      >
        📱 Responsivo
      </h2>
      <p
        style={{
          fontSize: "14px",
          marginBottom: "24px",
          color: isDark ? "#A3B8B0" : "#6B7280",
        }}
      >
        Breakpoints oficiais (xs&lt;480, sm≥480, md≥640, lg≥768, xl≥1024, 2xl≥1440),
        touch targets mínimos e safe-areas.
      </p>

      <ShowcaseSection
        title="1) Breakpoint atual"
        description="Informações em tempo real do viewport e categorias mobile/tablet/desktop."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Pill tone="success">breakpoint: {bp.breakpoint}</Pill>
          <Pill>{deviceLabel}</Pill>
          <Pill>
            viewport: {viewport.width}×{viewport.height}px
          </Pill>
          <Pill>touch: {bp.isTouchDevice ? "sim" : "não"}</Pill>
          <Pill>orientação: {bp.isPortrait ? "portrait" : bp.isLandscape ? "landscape" : "-"}</Pill>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="2) ResponsiveGrid"
        description="Grid de cards que altera colunas automaticamente por breakpoint."
      >
        <ResponsiveGrid
          cols={{ xs: 1, sm: 2, md: 2, lg: 3, xl: 4, "2xl": 5 }}
          gap={{ xs: "12px", sm: "16px", lg: "20px", xl: "24px" }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: "14px",
                padding: "16px",
                border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
                background: cardBg(i),
                minHeight: "80px",
                display: "grid",
                gap: "6px",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  color: isDark ? "#FFFFFF" : "#111827",
                }}
              >
                Card {i + 1}
              </div>
              <div style={{ fontSize: "12px", color: isDark ? "#A3B8B0" : "#6B7280" }}>
                Ajusta colunas por breakpoint
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </ShowcaseSection>

      <ShowcaseSection
        title="3) ResponsiveStack"
        description="Stack que troca column → row em breakpoints maiores."
      >
        <ResponsiveStack direction={{ xs: "column", lg: "row" }} gap={{ xs: "12px", lg: "16px" }}>
          <div
            style={{
              flex: 1,
              borderRadius: "14px",
              padding: "16px",
              border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
              background: isDark ? "#243530" : "#F0FFF4",
            }}
          >
            Item A
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: "14px",
              padding: "16px",
              border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
              background: isDark ? "#243530" : "#F0FFF4",
            }}
          >
            Item B
          </div>
          <div
            style={{
              flex: 1,
              borderRadius: "14px",
              padding: "16px",
              border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
              background: isDark ? "#243530" : "#F0FFF4",
            }}
          >
            Item C
          </div>
        </ResponsiveStack>
      </ShowcaseSection>

      <ShowcaseSection
        title="4) Show/Hide por breakpoint"
        description="Componentes utilitários MobileOnly / TabletOnly / DesktopOnly."
      >
        <div style={{ display: "grid", gap: "10px" }}>
          <MobileOnly>
            <div style={{ padding: "14px", borderRadius: "14px", background: cardBg(0) }}>
              Visível apenas em <b>Mobile</b> (xs/sm)
            </div>
          </MobileOnly>
          <TabletOnly>
            <div style={{ padding: "14px", borderRadius: "14px", background: cardBg(1) }}>
              Visível apenas em <b>Tablet</b> (md/lg)
            </div>
          </TabletOnly>
          <DesktopOnly>
            <div style={{ padding: "14px", borderRadius: "14px", background: cardBg(2) }}>
              Visível apenas em <b>Desktop</b> (xl/2xl)
            </div>
          </DesktopOnly>
          <div style={{ fontSize: "12px", color: isDark ? "#A3B8B0" : "#6B7280" }}>
            (Troque o tamanho da janela para ver alternar)
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="5) Touch targets (mínimo 44×44px)"
        description="Botões com medição real de altura/largura no DOM."
      >
        <div style={{ display: "grid", gap: "18px" }}>
          <MeasureButton label="Button sm" size="sm" tone="secondary" />
          <MeasureButton label="Button default" size="default" tone="default" />
          <MeasureButton label="Button lg" size="lg" tone="success" />
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        title="6) Safe areas (iOS)"
        description="Leitura das CSS vars (--safe-area-*) e estado detectado do dispositivo."
      >
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <Pill>iOS: {ios.isIOS ? "sim" : "não"}</Pill>
            <Pill>iPad: {ios.isIPad ? "sim" : "não"}</Pill>
            <Pill>iPhone: {ios.isIPhone ? "sim" : "não"}</Pill>
            <Pill>safe-area: {ios.hasSafeArea ? "sim" : "não"}</Pill>
            <Pill>notch: {ios.hasNotch ? "sim" : "não"}</Pill>
            <Pill>dynamic island: {ios.hasDynamicIsland ? "sim" : "não"}</Pill>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <Pill>top: {safeArea.top}</Pill>
            <Pill>bottom: {safeArea.bottom}</Pill>
            <Pill>left: {safeArea.left}</Pill>
            <Pill>right: {safeArea.right}</Pill>
          </div>

          <div
            className="safe-area-all"
            style={{
              borderRadius: "16px",
              border: `1px solid ${isDark ? "#2A3F36" : "#A5D6A7"}`,
              background: isDark ? "#0A0F0D" : "#F0FFF4",
              minHeight: "120px",
            }}
          >
            <div
              style={{
                borderRadius: "12px",
                background: isDark ? "#243530" : "#D4EDDA",
                border: `1px dashed ${isDark ? "#2A3F36" : "#A5D6A7"}`,
                padding: "14px",
                color: isDark ? "#FFFFFF" : "#111827",
              }}
            >
              Este bloco aplica <b>safe-area-all</b> (padding via env()).
            </div>
          </div>
        </div>
      </ShowcaseSection>
    </div>
  )
}

export default ResponsiveShowcase


