# assets — arquivos de marca

**Já preenchido** pela extração da marca de 2026-08-08 (repositório do ANEST App,
commit `066a9a6`).

| Arquivo | O que é |
|---|---|
| `marca.json` | Tokens de marca. `build_pdf.py` carrega paleta e caminhos de logo daqui automaticamente |
| `anest-logo.svg` | Fundo claro — wordmark `#133A11` + ECG `#9CCB64` |
| `anest-logo-branco.svg` | Negativo 100% branco, para a capa verde |
| `anest-logo-dark.svg` | Fundo escuro — branco + ECG `#9CCB64`, preserva os dois tons |
| `gerar-logos.py` | Regenera os três SVGs a partir do master raster do repositório |

Verde institucional: `#004225`. Não há símbolo isolado — a marca é o wordmark
"Anest" com a linha de ECG, e o cabeçalho corrido usa o logo completo reduzido.

Se estes arquivos sumirem, `build_pdf.py` renderiza um wordmark tipográfico
"ANEST". O documento fica correto, mas o arquivo real é melhor.

Origem: design system do ANEST App. Detalhes e ressalvas em
`referencias/identidade-visual.md` e no campo `observacoes` de `marca.json`.

## Como usar

    python3 scripts/build_pdf.py entrada.md saida.pdf --logo assets/anest-logo.svg

No HTML do guia rápido, colocar o marcador `{{LOGO}}` onde o logo deve entrar.
