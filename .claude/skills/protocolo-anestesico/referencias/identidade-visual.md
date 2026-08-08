# Identidade visual — ANEST

Todos os documentos saem com a marca ANEST. A consistência visual é parte do
valor: um protocolo que parece documento institucional é tratado como documento
institucional.

---

## Paleta

Extraída do design system do ANEST App em 2026-08-08 (commit `066a9a6`). A chave
entre parênteses é o nome em `assets/marca.json`, que é o que `build_pdf.py` lê.

| Uso | Onde | Hex |
|---|---|---|
| **Primária — verde institucional ANEST** (`verde_institucional`) | Capa, títulos de seção, cabeçalho de tabela | `#004225` |
| Verde profundo (`verde_profundo`) | Profundidade, gradiente de capa | `#002215` |
| Verde claro (`verde_claro`) | Destaque sobre fundo escuro, kicker | `#9BC53D` |
| Verde tênue (`verde_tenue`) | Fundo alternado de tabela | `#E8F5E9` |
| **Âmbar — atenção** (`ambar_atencao`) | Caixas de alerta, marcadores de fase de transição | `#F59E0B` |
| **Vermelho — crítico** (`vermelho_alerta`) | Valores-limite, condutas de emergência, "não fazer" | `#DC2626` |
| Dourado (`dourado`) | Régua da capa, sublinhado do wordmark tipográfico | `#C8952B` |
| Texto (`grafite`) | | `#111827` |
| Texto secundário (`cinza_apoio`) | | `#6B7280` |
| Linha e borda | | `#C8E6C9` |

Os hexes acima são tokens reais do app, com uma exceção declarada: **`dourado`
não existe no design system do ANEST** — nenhum token dourado/gold, em lugar
nenhum. O valor `#C8952B` foi herdado do gerador de PDF, não extraído do app.

O verde institucional é `#004225` (`--primary` do app). O `#004D26` que circulou
nas versões provisórias desta skill **não aparece uma única vez no repositório**.

**Regra de uso do vermelho:** reservado para limite e emergência. Nunca
decorativo. Se tudo é vermelho, nada é vermelho.

## Tipografia

DejaVu Sans em todo o documento — cobertura completa de acentuação e dos símbolos
que um protocolo precisa: `≥ ≤ ± × → ↑ ↓ ° µ ₂ ⁻`.

**A fonte da marca não é essa.** O ANEST App usa **Inter** (pesos 400/500/600/700),
carregada do CDN do Google Fonts; não há nenhum arquivo de fonte versionado no
repositório. Sem arquivo local, WeasyPrint não renderiza Inter de forma
confiável, então o PDF fica em DejaVu Sans. Os PDFs que o próprio app gera hoje
(jsPDF) usam Helvetica — ou seja, nenhuma das três superfícies usa Inter de fato.
Para alinhar de verdade, seria preciso versionar os `.woff2`/`.ttf` da Inter.

| Elemento | Tamanho |
|---|---|
| Título de capa | 27 pt bold |
| Título de seção (H2) | 14 pt bold |
| Subtítulo (H3) | 10,5 pt |
| Corpo | 9 pt |
| Tabela | 7,9 pt |
| Guia rápido — corpo | 8 pt |
| Guia rápido — tabela | 6,9–7,2 pt (piso absoluto: 6,5 pt) |

---

## Logotipo

O script aceita o logo por parâmetro:

```bash
python3 scripts/build_pdf.py entrada.md saida.pdf --logo assets/anest-logo.svg
```

**Posições:** capa (grande, versão monocromática branca sobre o verde) e
cabeçalho corrido (pequena, à esquerda).

**Se o arquivo do logo não for fornecido**, o script renderiza um wordmark
tipográfico "ANEST" na cor institucional. Funciona, mas o arquivo real é melhor.

### A marca é um wordmark

A palavra "Anest" em verde-escuro, atravessada por uma linha de ECG em
verde-claro que sai da base das letras e forma um complexo QRS à direita.
**Não existe símbolo destacável** — nenhum ícone que funcione sozinho. Por isso
o cabeçalho corrido usa o logo completo em tamanho reduzido, e não um recorte.

Cores da própria arte, medidas no master: wordmark `#133A11`, ECG `#9CCB64`.
Nenhuma das duas é um token do design system, e é assim mesmo — os SVGs
preservam a marca, os tokens da tabela acima governam a diagramação.

### Os três arquivos em `assets/`

| Arquivo | Cores | Para |
|---|---|---|
| `anest-logo.svg` | wordmark `#133A11` + ECG `#9CCB64` | Fundo claro: cabeçalho corrido, guia rápido |
| `anest-logo-branco.svg` | tudo `#FFFFFF` | Capa verde (`logos.negativo`) |
| `anest-logo-dark.svg` | wordmark `#FFFFFF` + ECG `#9CCB64` | Fundo escuro; preserva o contraste de dois tons |

A versão 100% branca funciona e é legível, mas achata a marca: o ECG passa a ler
como sublinhado do wordmark em vez de acento. Sobre a capa verde o `-dark`
fica melhor — para adotá-lo, apontar `logos.negativo` para ele em `marca.json`.

### Procedência — são vetorizados, não originais

O repositório do ANEST **não tem nenhum logo vetorial**. O único master é
`public/logo-anest-original.png` (1024×1024 RGBA), byte a byte idêntico em quatro
caminhos. Os SVGs foram traçados dele por `assets/gerar-logos.py`, que separa as
duas camadas de cor antes do trace — é isso que torna as variantes uma troca de
atributo `fill` em vez de uma reinterpretação da marca. Conferidos contra o
raster a 400 dpi: indistinguíveis. Se o master mudar, rodar o script de novo:

```bash
python3 .claude/skills/protocolo-anestesico/assets/gerar-logos.py
```

---

## Anatomia da capa

```
┌──────────────────────────────────┐
│                                  │  fundo verde #004225
│  [LOGO ANEST]                    │
│  ───                             │  régua âmbar
│  PROTOCOLO ASSISTENCIAL          │  kicker
│                                  │
│  Título do procedimento          │  27 pt
│                                  │
│  Subtítulo                       │
│                                  │
│  ─────────────────               │
│  Versão · datas · base normativa │  metadados
│  Referências · elaboração        │
│                                  │
│  ─────────────────               │
│  Aviso de uso interno            │  rodapé
└──────────────────────────────────┘
```

## Elementos recorrentes

- **Cabeçalho corrido:** logo pequeno (3,6 mm de altura) + nome do protocolo à
  esquerda; data à direita. 7 pt, cinza. O logo entra como `background-image` do
  margin box, com `background-size` controlando a altura — **não** como
  `content: url(...)`, que o WeasyPrint desenha no tamanho intrínseco da imagem
  (o SVG só declara `viewBox`, então sairia com ~263 mm por cima do texto).
  Sem arquivo de logo, o cabeçalho volta a ser só texto.
- **Rodapé:** aviso de uso interno à esquerda; `página / total` em verde à direita.
- **Títulos de seção:** verde, com linha inferior de 2,2 pt.
- **Subtítulos:** barra âmbar vertical de 3 pt à esquerda.
- **Caixas de alerta:** fundo creme com barra âmbar; fundo rosado com barra
  vermelha para o crítico.
- **Tabelas:** cabeçalho verde sólido com texto branco; linhas alternadas em
  verde tênue; cabeçalho **repetido** quando a tabela quebra entre páginas.

## Página de aprovação (obrigatória para Qmentum)

Última página do documento completo, com campos para assinatura:

| Campo | Conteúdo |
|---|---|
| Elaboração | Nome, CRM, data |
| Revisão técnica | Nome, CRM, data |
| Aprovação | Responsável técnico, data |
| Vigência | Data de início e data da próxima revisão |
| Histórico de versões | Tabela: versão, data, natureza da alteração, responsável |

É essa página que transforma o PDF em documento auditável.

---

## Fonte da verdade dos ativos

Extração feita em **2026-08-08** a partir do repositório do ANEST App (commit
`066a9a6`). Os valores deste arquivo já são os reais — não são mais provisórios.
Fontes: `public/logo-anest-original.png` (arte), `src/design-system/Tokens.json`,
`src/styles/anest-theme.css`, `tailwind.config.js`, `src/services/pdf/pdfBranding.js`
e `public/manifest.json`. A ordem de precedência é:

1. `assets/marca.json` — tokens extraídos do repositório. Se existir,
   `build_pdf.py` carrega a paleta daqui automaticamente e usa os caminhos de
   logo declarados em `logos`.
2. Parâmetros de linha de comando (`--logo`, `--logo-negativo`, `--marca`) —
   sobrepõem o JSON.
3. Valores embutidos no script — usados só quando não há `marca.json`.

Sem arquivo de logo, `build_pdf.py` desenha um wordmark tipográfico ANEST. O
documento sai correto e coerente, mas o arquivo real é melhor.

## Paridade entre Claude Code e Claude.ai

O repositório do ANEST App é a fonte da verdade. O Claude.ai recebe um artefato
de build.

| | Claude Code | Claude.ai |
|---|---|---|
| Onde a skill vive | `.claude/skills/protocolo-anestesico/` versionado em git | Pacote `.skill` enviado em Configurações → Skills |
| Ativos de marca | Arquivos reais em `assets/` | Vêm dentro do `.skill`, ou reconstruídos de base64 no handoff |
| Exemplos de referência | Arquivos do repositório | Base de conhecimento do projeto |
| Tarefas agendadas | Locais, enxergam o disco | Cowork, rodam remotamente e leem por conector |

Quando a skill ou os ativos mudarem no repositório, regerar
`dist/protocolo-anestesico.skill` e `dist/HANDOFF-CLAUDE-AI.md` e reenviar.
