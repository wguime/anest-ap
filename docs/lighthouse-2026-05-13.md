# Lighthouse Audit Post-v4.1.0 — 2026-05-13

Re-audit pós-deploy v4.1.0 (Sprint 19 bundle split + viewport fix + robots.txt) contra `https://anest-ap.web.app`.

## Scores

| Categoria | Score 2026-05-12 (v4.0.0) | Score 2026-05-13 (v4.1.0) | Delta |
|-----------|---------------------------|---------------------------|-------|
| Performance | 55 | **62** | +7 |
| Accessibility | 95 | **100** | +5 ✓ |
| Best Practices | 100 | **100** | 0 ✓ |
| SEO | 92 | **100** | +8 ✓ |

3 de 4 categorias atingiram score 100. Performance subiu 7 pontos com bundle split do Sp19; ainda gargalada por LCP/FCP altos (single-page React app sem SSR).

## Performance metrics breakdown

| Métrica | 2026-05-12 | 2026-05-13 | Delta | Status v4.1.0 |
|---------|-----------|-----------|-------|---------------|
| LCP (Largest Contentful Paint) | 7.8s | **5.3s** | -2.5s | 🔴 Poor (target <2.5s) |
| FCP (First Contentful Paint) | 6.1s | **5.0s** | -1.1s | 🔴 Poor (target <1.8s) |
| TBT (Total Blocking Time) | 20ms | **50ms** | +30ms | 🟢 Good (target <200ms) |
| CLS (Cumulative Layout Shift) | 0.12 | **0.146** | +0.026 | 🟡 NI (target <0.1) |
| Speed Index | 6.9s | **5.0s** | -1.9s | 🟡 Needs Improvement |
| TTI (Time to Interactive) | 7.8s | **6.1s** | -1.7s | 🔴 Poor |

Bundle split mostrou impacto real: -32% no LCP, -28% no Speed Index. CLS regrediu marginalmente — investigar `cls-culprits-insight` (Sprint 21).

## Top 5 audits failing/warning em Performance

| Audit | Score | Impacto |
|-------|-------|---------|
| `unused-javascript` | 0 | 1800ms savings — Firebase SDK + libs grandes ainda no main chunk |
| `unused-css-rules` | 0 | 110ms savings — Tailwind purge OK, mas custom CSS tem ~21KB sem uso |
| `valid-source-maps` | 0 | Best Practices: source maps ausentes em prod (já anotado Sp19) |
| `render-blocking-insight` | 0 | 580ms savings — `fonts.googleapis.com/css2` (845ms wasted) + `index-*.css` (311ms) |
| `layout-shifts` / `unsized-images` | 0/50 | LCP image (Anest2.webp) sem `width`/`height` explícitos no `<img>` |

## Top 3 oportunidades quick-win aplicadas NESTA sprint

1. **Preload LCP image (`Anest2.webp`)** em `index.html` com `fetchpriority="high"`. Esperado: -300 a -500ms no LCP. Browser inicia download paralelo ao parse do HTML, antes do React montar `LoginPage`.

2. **Cache-control estendido para imagens estáticas** (`firebase.json`). Adicionada regra `**/*.@(jpg|jpeg|png|webp|gif|svg|ico|woff|woff2)` com `max-age=2592000` (30 dias). Antes: `Anest2.webp` tinha cache 1h (28.8KB wasted apontados pelo Lighthouse). Endereça `cache-insight` parcialmente. Aplicado nos sites `anest-ap` e `anest-v2`.

3. **DNS-prefetch para Firebase auth iframe** (`apis.google.com`, `anest-ap.firebaseapp.com`). Resolve DNS em paralelo enquanto o React boot está rodando; reduz latência do auth handshake pós-login.

## Demais oportunidades documentadas pra Sprint 21+

| Oportunidade | Categoria | Esforço | Impacto estimado |
|-------------|-----------|---------|------------------|
| Reduce unused JavaScript (-1800ms) | Performance | Médio | +10 pts (code-split adicional, Firebase chunks) |
| Self-host Google Fonts ou inline `<style>` crítico | Performance | Médio | +5 pts (remove 845ms render-blocking de `fonts.googleapis.com`) |
| Critical CSS inline (acima do fold) | Performance | Médio-Alto | +5 pts (-311ms render-blocking do `index-*.css`) |
| Adicionar `width`/`height` em `<img>` (especialmente Anest2 no LoginPage) | Performance | Baixo | +5 pts CLS |
| SSR/SSG para landing/login (Vite SSR ou pré-render) | Performance | Alto | +20-30 pts LCP/FCP |
| Source maps em prod (`build.sourcemap: true`) | Best Practices | Baixo | já 100 — aud diagnóstico |
| Investigar `cls-culprits-insight` (regressão CLS 0.12→0.146) | Performance | Baixo | +3 pts CLS |
| `llms.txt` por recomendação Lighthouse | SEO | Baixo | já 100 — marginal |
| `image-delivery-insight` (Anest2.webp poderia ser AVIF + responsive `srcset`) | Performance | Médio | +3 pts |

## Comando para re-audit

```bash
npx --yes lighthouse https://anest-ap.web.app \
  --output html --output json \
  --output-path ./lighthouse-YYYY-MM-DD \
  --chrome-flags="--headless --no-sandbox" --quiet
```

HTML/JSON são gitignored (>800KB combinados). Commitar só este markdown.

## Esperado pós-deploy desta sprint

- LCP: 5.3s → ~4.8s (preload hero)
- Performance: 62 → ~65-68
- A11y / BP / SEO: mantém 100

Re-audit recomendado 24h após o próximo deploy de produção.
