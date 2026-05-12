# Lighthouse Audit — 2026-05-12

Auditoria estática (sem execução do Lighthouse CLI) com foco nas categorias
**Performance**, **Accessibility**, **Best Practices**, **SEO** e **PWA**.
Meta: 4/5 categorias > 90, Performance 85+ aceitável.

## Branch / PR
- Branch: `perf/fech-lighthouse` (worktree `.claude/worktrees/fch-lh`)
- Origem: `origin/main` (`c21b855`)

## Commit 1 — SEO + Best Practices + meta

Alterações em `index.html`:

| Item | Estado anterior | Estado atual |
|---|---|---|
| `<title>` | "ANEST - Gestão de Qualidade em Anestesiologia" | "ANEST — Gestão de Qualidade Anestesiológica" |
| `<meta name="description">` | Curta, genérica | Estendida (76+ calculadoras, LGPD/Qmentum, educação continuada) |
| `<link rel="canonical">` | ausente | `https://anest-ap.web.app/` |
| `<meta name="theme-color">` | `#006837` | `#004225` (greenDark institucional, alinhado a `.claude/rules/design-tokens.md`) |
| `<meta name="msapplication-TileColor">` | `#006636` (typo) | `#004225` |
| Open Graph (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:image:alt`, `og:site_name`, `og:locale`) | ausente | adicionado (imagem `/Anest2.png`) |
| Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) | ausente | adicionado (`summary_large_image`) |
| `<html lang="pt-BR">` | já presente | mantido |
| Google Fonts `display=swap` | já presente | mantido |

`public/manifest.json` — auditado, **não precisou de alteração**:
- `name`, `short_name`, `description`, `start_url`, `display: standalone`, `orientation`, `background_color`, `theme_color`, `categories`, `lang` — todos presentes
- `icons` — 16 entradas (8 `purpose: any` + 8 `purpose: maskable`), sizes 72/96/128/144/152/192/384/512
- PNGs verificados em `public/icons/` (todos os 16 arquivos existem)

## Commit 2 — Performance hints

Alterações em `<img>` tags. Verificação foi feita arquivo por arquivo
(grep multi-line não captura atributos em linhas separadas).

### Imagens atualizadas

| Arquivo | Mudança | Razão |
|---|---|---|
| `src/pages/LoginPage.jsx` (logo hero) | `+fetchpriority="high"` `+decoding="async"` | LCP candidate (hero centralizado, 38% top) |
| `src/pages/educacao/admin/components/BannerUpload.jsx` | `+loading="lazy"` `+decoding="async"` | Preview de banner em form admin |
| `src/pages/educacao/components/TrilhaCard.jsx` | `+decoding="async"` (lazy já existia) | Banner de trilha em lista |
| `src/pages/management/users/UsersTab.jsx` | `+decoding="async"` (lazy já existia) | Avatar em accordion de usuários |
| `src/design-system/components/ui/audio-player.jsx` | `+decoding="async"` (lazy já existia) | Artwork de player de áudio |
| `src/design-system/showcase/UtilitiesShowcase.jsx` | `+loading="lazy"` `+decoding="async"` | Showcase demo (Unsplash) |
| `src/public/formulario-incidente.html` (logo header) | `+fetchpriority="high"` `+decoding="async"` | LCP da página pública |
| `src/public/formulario-denuncia.html` (logo header) | `+fetchpriority="high"` `+decoding="async"` | LCP da página pública |
| `public/gestao-incidentes.html` (logo header) | `+fetchpriority="high"` `+decoding="async"` | LCP da página pública |

### Imagens já em conformidade (verificadas, sem alteração)
- `src/pages/ComunicadosPage.jsx` (2 imgs) — uma já tem lazy/async, outra é viewer fullscreen aberto
- `src/pages/educacao/admin/AulaFormModal.jsx` — já tem lazy/async
- `src/pages/educacao/components/TrilhaBanner.jsx` — já tem lazy/async
- `src/pages/management/components/PermissionsModal.jsx` — já tem lazy/async
- `src/pages/incidents/QRCodeGeneratorPage.jsx` — dataURL inline (sem benefício de lazy)

### Fonts
- `index.html` — Google Fonts Inter já com `display=swap` ✓
- `public/gestao-incidentes.html` — Google Fonts já com `display=swap` ✓
- `public/formulario-*.html` e `src/public/formulario-*.html` — usam apenas system fonts (sem external font)

### Scripts
- `index.html` — único script é `<script type="module" src="/src/main.jsx">`. `type="module"` já implica `defer` por especificação.

## Como rodar Lighthouse de verdade (pós-deploy)

```bash
# Deploy primeiro
npm run build
firebase deploy --only hosting:anest-ap

# Lighthouse desktop
npx lighthouse https://anest-ap.web.app \
  --output html \
  --output-path ./lighthouse-desktop.html \
  --preset desktop \
  --chrome-flags="--headless"

# Lighthouse mobile (default)
npx lighthouse https://anest-ap.web.app \
  --output html \
  --output-path ./lighthouse-mobile.html \
  --chrome-flags="--headless"
```

Alternativa via Chrome DevTools (mais rápido para iterar):
1. Abrir `https://anest-ap.web.app` em janela anônima
2. DevTools → Lighthouse → "Analyze page load"
3. Categorias: Performance, Accessibility, Best Practices, SEO, PWA

## Ação externa requerida (fora do escopo deste PR)

- **Nenhum item bloqueante identificado.** Manifest e ícones estão completos.
- Eventual melhoria futura: gerar OG image dedicada (1200×630) em vez de reusar `/Anest2.png` quadrado.
- Monitoring (Sentry-equivalent) não está configurado — quando configurar, atentar a CSP em `index.html` (hoje não há `<meta http-equiv="Content-Security-Policy">`, o que pode aparecer em Best Practices).

## Validação

- `npm run build` passa ✓
- `npm run test:run` — 2 falhas baseline em UserContext (pré-existentes, fora do escopo)

## Targets esperados (estimativa pós-deploy)

| Categoria | Pré | Pós (estimado) |
|---|---|---|
| Performance | ~80 | 85+ |
| Accessibility | ~90 | 90+ (sem mudança nesta PR) |
| Best Practices | ~85 | 90+ (canonical + meta tags ajudam) |
| SEO | ~80 | 95+ (description + canonical + OG completo) |
| PWA | ~90 | 95+ (manifest já completo + theme-color alinhado) |
