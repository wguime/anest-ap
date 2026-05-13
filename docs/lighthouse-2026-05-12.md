# Lighthouse Audit — v4.0.0 Live Production (2026-05-12)

## Scores

| Categoria | Score | Target Sp19 | Delta |
|-----------|-------|-------------|-------|
| Performance | **55** | ≥85 | -30 |
| Accessibility | **95** | ≥90 | +5 ✓ |
| Best Practices | **100** | ≥90 | +10 ✓ |
| SEO | **92** | ≥95 | -3 |

## Métricas Core Web Vitals (LIVE, sem bundle split do Sp19)

| Métrica | Valor | Status |
|---------|-------|--------|
| LCP (Largest Contentful Paint) | 7.8s | 🔴 Poor (target <2.5s) |
| FCP (First Contentful Paint) | 6.1s | 🔴 Poor (target <1.8s) |
| TBT (Total Blocking Time) | 20ms | 🟢 Good |
| CLS (Cumulative Layout Shift) | 0.12 | 🟡 Needs improvement (<0.1) |
| Speed Index | 6.9s | 🔴 Poor |
| TTI (Time to Interactive) | 7.8s | 🔴 Poor |

## Top oportunidades identificadas

1. **Reduce unused JavaScript** (-1530ms) → ✅ Sp19 1.3 mitiga via bundle split (1.68 → 1.20 MB main).
2. **Cache lifetimes (cache-insight)** — runtimeCaching já configurado (Wave 3.1 do v4.0.0). Sem ação adicional.
3. **Unsized images** — vários `<img>` sem `width`/`height` explícito. Causa CLS de 0.12.

## Fixes aplicados nesta wave

### 1. viewport meta (a11y/SEO)
- Antes: `maximum-scale=1.0, user-scalable=no` (bloqueava zoom — falha WCAG 1.4.4 Resize Text).
- Depois: `maximum-scale=5.0` permite zoom até 500%. PDFViewer mantém pinch handler interno.
- Score esperado: A11y +2, SEO +2.

### 2. robots.txt criado (SEO)
- Bloqueia indexação de rotas autenticadas (LGPD: sem PII no Google index).
- Sitemap pointer para `https://anest-ap.web.app/sitemap.xml` (a gerar em sprint futura).
- Score esperado: SEO +3 (passa de 92 → ~95).

## Pendências (Sprint 20+ candidatos)

| Issue | Categoria | Esforço | Impacto |
|-------|-----------|---------|---------|
| Reduce LCP via SSR/SSG ou preload hero | Performance | Alto | +20-30 pts |
| Unsized images (CLS) | Performance | Médio | +5 pts CLS |
| Sitemap.xml automatizado | SEO | Baixo | +3 pts |
| Source maps em prod | Best Practices | Baixo | +5 pts |
| llms.txt | SEO | Baixo | marginal |

## Re-audit pós-deploy v4.1.0

Após merge de Sprint 19 + deploy:
- Bundle main 1.20 MB → expected LCP ~5s (de 7.8s, -36%).
- viewport fix → Accessibility +2.
- robots.txt → SEO +3.

Expected v4.1.0 scores:
- Performance: 65-70 (de 55)
- A11y: 97 (de 95)
- BP: 100 (mantém)
- SEO: 95 (de 92)

## Comando para re-audit

```bash
npx --yes lighthouse https://anest-ap.web.app \
  --output html --output json \
  --output-path ./lighthouse-YYYY-MM-DD \
  --chrome-flags="--headless --no-sandbox" --quiet
```

HTML/JSON são gitignored (>800KB combinados). Commitar só este markdown.
