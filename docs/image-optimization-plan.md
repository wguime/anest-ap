# Image Optimization Plan — ANEST

> Status: planejamento (não executado). Atualizado em 2026-05-12.

## Contexto

O bundle atual carrega ~10 ativos PNG/JPG estáticos servidos de `public/` e referenciados em React (`<img src="…" />`). Já temos `loading="lazy"` + `decoding="async"` aplicados consistentemente em imagens não-LCP (audit ⇒ commit `perf(img)`), e `fetchpriority="high"` no logo da LoginPage (LCP).

Esta nota documenta o **próximo passo**: converter os ativos pesados para **WebP** (com fallback PNG/JPG), reduzindo ~70 % do peso de imagem na rota de login e ~50 % nos comunicados/banners.

## Por que NÃO converter agora

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
