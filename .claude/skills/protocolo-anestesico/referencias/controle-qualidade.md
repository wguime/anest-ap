# Controle de qualidade

Três checagens, nesta ordem. A primeira é automática e **bloqueante**.

---

## 1. Checagem automática (obrigatória)

```bash
pip install weasyprint markdown pdf2image pypdf --break-system-packages -q
python3 scripts/checa_qualidade.py protocolo.md --doses doses.json
```

O script sai com erro se encontrar problema bloqueante. **Não renderizar com
erro pendente.**

### O que ele confere

**Bloqueante:**
- Tabela quebrada (contagem no fonte ≠ renderizada)
- Pipe solto em parágrafo — tabela virou texto corrido
- Citação órfã — marcador `[n]` no corpo sem entrada correspondente na §22
- Aritmética de diluição — concentração declarada vs. calculada
- Aritmética das tabelas ml/h por peso

**Aviso:**
- Uso de `~` (fica parecido com sinal de menos em várias fontes)
- Poucos marcadores de citação
- Referência listada mas nunca citada
- Metas adjetivas ("diurese adequada")
- Marcos temporais sem legenda declarando o referencial
- Seções 21 ou 22 ausentes

### Montar o doses.json

Uma entrada por infusão contínua do protocolo:

```json
[{"farmaco": "Noradrenalina", "massa_mg": 16, "volume_ml": 250,
  "conc_declarada_ug_ml": 64,
  "tabela": [{"dose_ug_kg_min": 0.1, "peso_kg": 70, "ml_h_declarado": 6.6},
             {"dose_ug_kg_min": 0.3, "peso_kg": 70, "ml_h_declarado": 19.7}]}]
```

Não pule esta parte. É o único controle que pega erro de conta.

---

## 2. Coerência cruzada (manual, dirigida)

O mesmo número precisa aparecer igual em todos os lugares. Conferir entre
**documento completo × guia rápido**:

- [ ] Metas de temperatura
- [ ] Taxas de fluido por fase
- [ ] Parâmetros ventilatórios
- [ ] Faixas de dose de vasopressor
- [ ] Gatilhos transfusionais
- [ ] Critérios de extubação
- [ ] Quantidades de material
- [ ] Legendas dos marcos temporais

Divergência entre o completo e o guia rápido é o erro mais grave desta família,
porque o guia é o que vai ser usado sob pressão.

---

## 3. Revisão visual

```python
from pdf2image import convert_from_path
imgs = convert_from_path("saida.pdf", dpi=72)
for i, im in enumerate(imgs): im.save("/tmp/pg%02d.png" % (i+1))
```

Inspecionar no mínimo: capa, sumário, a página com mais tabelas, a seção de
diluições, os algoritmos e a última página.

- [ ] Logo ANEST presente na capa e no cabeçalho
- [ ] Nenhum pipe visível fora de tabela
- [ ] Nenhuma página em branco ou quase vazia
- [ ] Cabeçalho de tabela repetido quando quebra entre páginas
- [ ] Nenhum texto cortado na margem
- [ ] Blocos de algoritmo alinhados
- [ ] Guia rápido dentro do número de páginas previsto

Detectar páginas quase vazias:

```python
from pypdf import PdfReader
for i, pg in enumerate(PdfReader("saida.pdf").pages):
    if len(pg.extract_text().strip()) < 160: print("quase vazia:", i+1)
```

---

## Regras de escrita do markdown

Erros de conversão são silenciosos. Estas regras previnem os recorrentes:

| Regra | Por quê |
|---|---|
| **Linha em branco antes de toda tabela** | Sem ela o conversor imprime os pipes crus. Vale inclusive depois de um título `###` |
| **Linha em branco antes de toda lista** | Sem ela a lista é absorvida no parágrafo anterior |
| **Nunca usar `~` como "aproximadamente"** | Escrever "cerca de" |
| **`nl2br` ativado no conversor** | Sem isso linhas consecutivas viram parágrafo único e blocos de dose saem grudados |
| **Não usar `---` como separador** | Gera páginas quase em branco; o script já esconde `hr` |
| **Símbolos** | `₂ ₃ ⁻ ² × ≥ ≤ ↑ ↓ ° µ` funcionam em DejaVu. Dentro de bloco monoespaçado, preferir texto simples (`CO2`, `HCO3`) |

---

## Antes de entregar — declaração ao usuário

Informar sempre, no chat:
1. Quantas doses foram verificadas em duas fontes e quais ficaram com fonte única
2. Quais referências foram confirmadas em busca nesta sessão
3. Quais pontos dependem de confirmação com a farmácia da instituição
4. Quais recomendações ficaram em grau [C] ou [D] e por quê
