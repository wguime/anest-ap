# Image Optimization Plan — ANEST

> Status: **parcialmente executado** (Sprints 19 + 20). Atualizado em 2026-05-13.

## Execução Sprint 19 (PR #74) — banners de comunicado + logos

| Arquivo | Antes | Depois (.webp) | Redução | Refs runtime atualizados |
|---|---|---|---|---|
| `public/Anest2.png` (lossless logo) | 97 KB | 36 KB | **-63%** | sim (`LoginPage.jsx`) |
| `public/logo-anest.png` (lossless logo) | 28 KB | 13 KB | **-54%** | sim (HTML público) |
| `public/comunicados/25.10 Confra Anest.png` | 126 KB | 84 KB | **-33%** | n/a (anexo Storage) |
| `public/comunicados/25.11 Treinamento Robótica e infecção .JPG` | 133 KB | 47 KB | **-65%** | n/a (anexo Storage) |
| **Subtotal Sprint 19** | **384 KB** | **180 KB** | **-204 KB (-53%)** | |

## Execução Sprint 20 Stream 1.3 — documentos pesados raster

Conversão de imagens raster remanescentes em `public/documentos/` (>50 KB) via `scripts/optimize-images.mjs` (sharp, quality=80, effort=6).

| Arquivo | Antes | Depois (.webp) | Redução | Refs runtime atualizados |
|---|---|---|---|---|
| `public/documentos/novos/Organograma2025.jpg` | 211 KB | 52 KB | **-75%** | n/a (anexo de documento, sem `<img>` em runtime) |
| `public/documentos/indicadores/PHOTO-2025-11-04-17-15-22.jpg` | 183 KB | 74 KB | **-60%** | n/a (anexo de documento, sem `<img>` em runtime) |
| **Subtotal Sprint 20** | **395 KB** | **126 KB** | **-268 KB (-68%)** | |

### Total acumulado v4.0.0+
**~779 KB → ~306 KB** = **472 KB economizados** (redução média -61% nos assets convertidos).

### Itens skipped — não convertidos (com motivo)

| Arquivo | Motivo |
|---|---|
| `public/comunicados/25.10 Bate mapa.png` (~274 KB) | `file(1)` reporta "PDF document version 1.7" — a extensão `.png` está mentindo (provavelmente export do Pages/Numbers/iWork salvou PDF com extensão errada). Sharp rejeita com "Input file contains unsupported image format". **Ação:** re-export a partir da fonte original como PNG ou JPG real, depois rodar conversão. |
| `public/apple-touch-icon*.png` (~32 KB) | iOS Home Screen Web App spec exige PNG. Não aceita WebP. |
| `public/icons/maskable-icon-*.png` (141–253 KB cada) | PWA Maskable spec (W3C) é strict para PNG; suporte a WebP em manifest icons ainda inconsistente entre browsers/launchers. ROI baixo + risco de quebra em instalação PWA. |
| `public/icons/icon-*.png` (141–253 KB cada) | Mesma razão: PWA install icons. |
| `public/logo-anest-original.png` / `public/Anest2-original.png` (1.3 MB cada) | Assets-fonte, NÃO servidos em runtime. Manter como master para regenerar versões pequenas se necessário. |

### Padrão runtime para futuras conversões

Quando uma imagem **tem** ref `<img src="…">` no React/HTML, atualizar para:

```jsx
<picture>
  <source srcSet="/path/file.webp" type="image/webp" />
  <img src="/path/file.jpg" alt="…" loading="lazy" decoding="async" />
</picture>
```

Para os assets de Sprint 20 (Organograma + PHOTO), nenhum ref runtime foi encontrado (`grep -r "Organograma2025\|PHOTO-2025-11-04" src/ public/`); são anexos de documentos servidos via PDF/download, então não há `<picture>` a atualizar. O `.webp` fica disponível ao lado para ser consumido em features futuras (ex: preview inline do organograma).

## Contexto

O bundle atual carrega ~10 ativos PNG/JPG estáticos servidos de `public/` e referenciados em React (`<img src="…" />`). Já temos `loading="lazy"` + `decoding="async"` aplicados consistentemente em imagens não-LCP (audit ⇒ commit `perf(img)`), e `fetchpriority="high"` no logo da LoginPage (LCP).

Esta nota documenta o **próximo passo**: converter os ativos pesados para **WebP** (com fallback PNG/JPG), reduzindo ~70 % do peso de imagem na rota de login e ~50 % nos comunicados/banners.

## Por que NÃO converter agora (raciocínio histórico — pré Sprint 19)

> Mantido para registro. Sprints 19 + 20 executaram a conversão dos candidatos com maior ROI; ver tabelas acima.

- **Commit-binary-churn**: cada conversão adiciona um binário novo ao histórico Git. Em revisões futuras (quando a arte for redesenhada) o repo cresce duplicado.
- **Risco baixo / benefício marginal hoje**: lazy-loading + decoding async já cobre o caminho crítico. A LCP da home está dentro de orçamento.
- **Migração de assets via Storage**: parte das imagens de comunicado migrarão para Supabase Storage (já entregue Sprint 12). Converter assets locais agora pode duplicar esforço com a migração CDN.

## Candidatos prioritários (ordenados por peso)

| Arquivo | Tamanho atual | Tipo | Uso | Prioridade |
|---|---|---|---|---|
| `public/logo-anest-original.png` | 1.3 MB | PNG | Logo institucional (asset fonte) | Baixa — não servido em runtime |
| `public/Anest2-original.png` | 1.3 MB | PNG | Logo splash (asset fonte) | Baixa — não servido em runtime |
| `public/Anest2.png` | 97 KB | PNG | LCP da LoginPage | **Alta** — já tem `Anest2.webp` ao lado via `<picture>` |
| `public/comunicados/25.10 Bate mapa.png` | 274 KB | PNG | Anexo comunicado | Média |
| `public/documentos/novos/Organograma2025.jpg` | 211 KB | JPG | Documento organograma | Média |
| `public/icons/maskable-icon-512x512.png` | 253 KB | PNG | PWA maskable icon | Baixa — PWA spec aceita PNG |
| `public/icons/maskable-icon-384x384.png` | 141 KB | PNG | PWA maskable icon | Baixa |
| `public/comunicados/25.11 Treinamento Robótica e infecção .JPG` | 133 KB | JPG | Anexo comunicado | Média |
| `public/comunicados/25.10 Confra Anest.png` | 126 KB | PNG | Anexo comunicado | Média |
| `public/apple-touch-icon.png` | 32 KB | PNG | iOS home icon | Baixa — iOS preferia PNG |
| `public/logo-anest.png` | 28 KB | PNG | Logo header HTML público | Média |

> Ícones PWA (`icons/icon-*`, `icons/maskable-icon-*`) ficam fora do escopo: a spec PWA e o iOS exigem PNG.

## Ferramenta recomendada

CLI: **[cwebp](https://developers.google.com/speed/webp/download)** (parte do `libwebp`, único binário, ~1 MB).

```bash
# Lossy 80 % (target para fotos / banners)
cwebp -q 80 input.png -o input.webp

# Lossless (target para logos com transparência)
cwebp -lossless input.png -o input.webp

# Batch com find
find public/comunicados -iname '*.png' -o -iname '*.jpg' | \
  while read f; do cwebp -q 80 "$f" -o "${f%.*}.webp"; done
```

Alternativa local sem CLI: usar `sharp` num script Node (`scripts/optimize-images.mjs`) — leitura/escrita programática + integração com pipeline de build.

## Padrão de marcação `<picture>`

Para **toda imagem com fallback WebP**, usar o elemento `<picture>` em vez de só trocar `src`:

```jsx
<picture>
  <source srcSet="/Anest2.webp" type="image/webp" />
  <img
    src="/Anest2.png"
    alt="ANEST"
    fetchpriority="high"
    decoding="async"
    className="…"
  />
</picture>
```

> Já é o padrão usado em `src/pages/LoginPage.jsx`. Estender para banners de comunicado / banners de trilha quando a migração ocorrer.

## Quando executar

Trigger sugerido: **antes de Sprint de marketing externo** (campanha que aumenta tráfego de login) **OU** quando a migração de anexos para Supabase Storage for finalizada (evita duplicação de esforço).

Estimativa de redução de bundle estático: **~1.0 MB → ~350 KB** (apenas com os 6 candidatos média/alta prioridade convertidos lossy 80 %).

## Checklist de migração (futura)

- [ ] Instalar `cwebp` localmente ou adicionar `sharp` como devDep.
- [ ] Rodar conversão em lote para os candidatos prioritários acima.
- [ ] Auditar visualmente cada par (PNG/JPG ↔ WebP) — quality 80 ok? lossless necessário para logos com transparência?
- [ ] Substituir `<img>` por `<picture>` nos componentes que consomem cada asset.
- [ ] Manter o PNG/JPG original (fallback Safari < 14 e crawlers que não suportam WebP).
- [ ] Atualizar `public/manifest.json` somente se o PWA passar a aceitar WebP em `icons` (atualmente: não).
- [ ] Smoke test no Lighthouse: confirmar redução de LCP / CLS estável.

## Referências

- WebP browser support: https://caniuse.com/webp (97 %+ global, todos os mobiles relevantes).
- `<picture>` MDN: https://developer.mozilla.org/docs/Web/HTML/Element/picture
- `fetchpriority`: https://web.dev/articles/fetch-priority
