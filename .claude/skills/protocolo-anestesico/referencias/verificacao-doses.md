# Verificação de doses — três camadas

Erro de dose em documento institucional se propaga. Uma vez impresso e afixado,
ninguém recalcula. Este é o controle mais importante da skill.

**Regra:** nenhuma dose, diluição ou taxa de infusão entra no documento sem
passar pelas três camadas.

---

## Camada 1 — Fonte

Toda dose precisa de **duas fontes independentes** que concordem. Se divergirem,
usar a mais conservadora e **declarar a divergência** no documento.

### Fontes aceitas

| Categoria | Fonte |
|---|---|
| **Regulatória brasileira** | Bulário Eletrônico ANVISA (bula do fabricante), Formulário Terapêutico Nacional |
| **Referência farmacológica** | Micromedex, Lexicomp, UpToDate, Martindale, BNF |
| **Diretriz específica** | A dose recomendada pela diretriz do procedimento tem precedência quando difere da bula por indicação off-label consagrada |
| **Literatura primária** | Para condutas onde a dose é o objeto do estudo |
| **Livro-texto** | Miller, MGH, Stoelting — aceito como **segunda** fonte, não como única |

### Não aceitos como fonte de dose
- Memória do modelo sem confirmação
- Protocolo institucional de outro serviço (é comparador, não fonte)
- Blog, resumo de rede social, material comercial de fabricante que não seja a bula
- Outro documento gerado por IA

### Uso off-label
Muita coisa em anestesia é off-label (lidocaína sistêmica, cetamina em dose
analgésica, magnésio como adjuvante). Isso é legítimo, mas exige:
- Marcar como **off-label** no documento
- Citar a diretriz ou o ensaio que sustenta a dose
- Não usar a bula como se autorizasse a indicação

---

## Camada 2 — Aritmética

Toda diluição e toda taxa de infusão é **recalculada por script**, não conferida
mentalmente. Rodar `scripts/checa_doses.py` sobre a tabela antes de renderizar.

O que o script confere:
- Concentração final = massa total ÷ volume final
- ml/h = (dose × peso × 60) ÷ concentração — para cada linha da tabela por peso
- Coerência entre a diluição descrita e a concentração declarada
- Coerência entre a faixa de dose no texto e a faixa na tabela

### Convenção obrigatória
**O volume declarado é sempre o VOLUME FINAL.** Escrever "16 mg em 250 ml"
significa 250 ml de solução pronta, não 250 ml de diluente + 16 ml de fármaco.
Declarar isso explicitamente no início da seção de diluições, com exemplo.

### Armadilhas a conferir sempre
| Armadilha | Verificação |
|---|---|
| **Noradrenalina base vs. hemitartarato** | A ampola BR rotulada "2 mg/ml, 4 ml" tem 8 mg de sal = 4 mg de base. Erro de 2× |
| **Adrenalina 1:1.000 vs. 1:10.000** | Declarar sempre em mg/ml junto da razão |
| **Sulfato de magnésio 50% vs. 10%** | 1 ml de 50% = 500 mg; de 10% = 100 mg |
| **Gluconato vs. cloreto de cálcio** | Mesma massa, 3× de diferença em cálcio elementar |
| **KCl 10% vs. 19,1%** | 1,34 vs. 2,56 mEq/ml |
| **Peso real vs. peso predito vs. peso ideal** | Declarar qual em toda dose |
| **µg/kg/min vs. µg/kg/h vs. mg/kg/h** | Erro de 60× |
| **Superfície corporal vs. peso** | Quimioterápicos e alguns antibióticos usam m² |

---

## Camada 3 — Contexto

A dose certa pode ser errada para este paciente ou este serviço.

- **Ajuste renal e hepático** declarado quando relevante
- **Extremos de peso** — obesidade e caquexia: qual peso usar
- **Idoso** — redução declarada em percentual, não "reduzir"
- **Dose máxima somada** para anestésicos locais, considerando **todas as vias**
  (neuroeixo + bloqueio de parede + infiltração + lidocaína sistêmica)
- **Teto de infusão** e duração máxima (lidocaína, nitroprussiato, propofol)
- **Interações** relevantes ao procedimento
- **Disponibilidade real** — se o serviço não tem o fármaco, oferecer a
  alternativa em vez de prescrever o inexistente (ver `contexto-institucional.md`)

---

## Registro de verificação

Ao final do trabalho, gerar uma **tabela de verificação de doses** que fica no
anexo do protocolo (§20) e serve de trilha de auditoria:

| Fármaco | Dose no documento | Fonte 1 | Fonte 2 | Confere? | Observação |
|---|---|---|---|---|---|

Doses que não puderam ser verificadas em duas fontes ficam marcadas em destaque
e são listadas ao usuário no chat, explicitamente, como **pendências de
conferência humana**.

---

## O que dizer ao usuário

Ao entregar, sempre informar:
1. Quantas doses foram verificadas em duas fontes
2. Quais ficaram com fonte única e por quê
3. Quais dependem de confirmação com a farmácia da instituição
4. Que o rodapé "conferir com as apresentações disponíveis" não é formalidade —
   apresentação comercial muda por fornecedor e por lote
