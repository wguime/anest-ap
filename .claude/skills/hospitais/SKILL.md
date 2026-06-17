---
name: hospitais
description: Importar docx mensal da escala de FDS/feriados das técnicas de enfermagem dos hospitais (HRO + UNIMED + Plantão Pago) e atualizar `src/data/hospitaisTecnicas2026.js` automaticamente. Card "Técnicas de Enfermagem" passa a exibir a escala nos FDS/feriados com rollover das 7h.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Importar Escala FDS/Feriados Hospitais — Novo Mês

## Quando Usar
- Usuário invocou `/hospitais <caminho-do-docx>` (ex.: `~/Desktop/ESCALA JULHO.docx` ou `Colaboradores/Hospitais 2026.07.docx`). O nome do arquivo é livre — use o path do argumento, não assuma a pasta `Colaboradores/`.
- Precisa adicionar entries em `src/data/hospitaisTecnicas<ANO>.js` para que o card Técnicas de Enfermagem auto-preencha em FDS/feriados.

> Repo canônico: `/Users/guilherme/dev/anest` (mudou de `~/Documents/IA/ANEST V2`). Rode tudo a partir daí.

## Fluxo resumido
1. Ler docx do mês.
2. Extrair tuplas `(dataKey, { unimed, hro, plantaoPago, label })` para cada FDS e feriado.
3. Atualizar `src/data/hospitaisTecnicas<ANO>.js` inserindo/substituindo as entries.
4. Validar funcionárias conhecidas (adicionar Mari ou novas se necessário).
5. Smoke test + build + commit + push + deploy.

---

## 1. Formato esperado do docx

Um docx por mês (nome livre — `Hospitais 2026.07.docx`, `ESCALA JULHO.docx`, etc.). Use o path passado no argumento.

Contém **uma tabela** com 4 colunas:
```
<MÊS> <ANO> | UNIMED                  | HRO                 | PLANTÃO PAGO
FERIADO
SEXTA SANTA | (07 AS 15) RENATA       | (07 AS 15) LUCIANA  | (15 AS 23) MARI
03/04/2026  | FUNC.UNIMED             |                     |
04/04/2026  | (07 AS 15) MARI         | (07 AS 15) RENATA   | (15 AS 23) LUCIANA
SABADO      | FUNC.UNIMED             |                     |
            |                         |                     | DOMINGO 05/04
            |                         |                     | (07 AS 15) RENATA
            |                         |                     | (15 AS 23) MARI
```

### Características
- **Cada dia ocupa múltiplas linhas** — o conteúdo de uma mesma célula tem quebras internas que incluem feriado label, data, dia da semana.
- **Domingos** aparecem dentro da coluna "Plantão Pago" com rótulo `DOMINGO DD/MM`.
- **UNIMED** só aparece em sábados e feriados (nunca em domingo).
- **FUNC.UNIMED** é um label indicativo da função — não é um nome. O **nome** está na linha `(07 AS 15) NOME`.
- **Plantão Pago** sempre é 15–23h; HRO/UNIMED são 07–15h.
- **Feriados** têm rótulo em linha acima da data (ex: "SEXTA SANTA", "TIRADENTES", "DIA DO TRABALHO").
- **Férias** em row final (ignorar — não é FDS diário).

---

## 2. Funcionárias cadastradas

`FUNCIONARIAS_HOSPITAIS` em `src/data/hospitaisTecnicas2026.js`:
```
marta, renata, luciana, elisete, saionara, mari
```

### NAME_TO_ID (normalização)
```
MARTA    → Marta
RENATA   → Renata
LUCIANA  → Luciana
ELISETE  → Elisete
SAIONARA → Saionara
MARI     → Mari
```

(Note: nomes são **armazenados com first-letter-upper**, não lowercase como em sobreaviso — veja o padrão atual no arquivo.)

Nomes fora dessa lista: parar e pedir confirmação.

---

## 3. Script Python de extração

O docx é **complexo** pela forma como o Numbers exporta — cada célula pode conter várias linhas, domingo fica grudado na célula do sábado. Estratégia:

```python
from docx import Document
import re
from datetime import datetime

PATH = 'Colaboradores/Hospitais 2026.06.docx'

d = Document(PATH)
# Cada tabela tem 4 colunas. Parse por paragraph em cada cell.
entries = {}
current_feriado_label = None

for t in d.tables:
  for row in t.rows[1:]:  # pula header
    cells = [c.text for c in row.cells]
    raw_dates = cells[0] if len(cells) >= 1 else ''
    raw_unimed = cells[1] if len(cells) >= 2 else ''
    raw_hro = cells[2] if len(cells) >= 3 else ''
    raw_plantao = cells[3] if len(cells) >= 4 else ''

    # Detectar label de feriado em raw_dates (linha "FERIADO" + linha com nome do feriado)
    label = None
    for line in raw_dates.split('\n'):
      line = line.strip()
      if line and not re.match(r'\d{2}/\d{2}/\d{4}', line) and line not in ('SABADO','DOMINGO'):
        # é um candidato a label
        if line not in ('FERIADO',):
          label = line.title()

    # Extrair data principal
    m = re.search(r'(\d{2})/(\d{2})/(\d{4})', raw_dates)
    if m:
      dd, mm, yy = m.groups()
      key = f"{yy}-{mm}-{dd}"
      # Parse UNIMED: "(07 AS 15) NOME"
      unimed_match = re.search(r'\(07 AS 15\)\s*(\w+)', raw_unimed, re.I)
      unimed = unimed_match.group(1).strip() if unimed_match else None
      hro_match = re.search(r'\(07 AS 15\)\s*(\w+)', raw_hro, re.I)
      hro = hro_match.group(1).strip() if hro_match else None
      plantao_match = re.search(r'\(15 AS 23\)\s*(\w+)', raw_plantao, re.I)
      plantao = plantao_match.group(1).strip() if plantao_match else None
      entries[key] = {
        'unimed': unimed.title() if unimed else None,
        'hro': hro.title() if hro else None,
        'plantaoPago': plantao.title() if plantao else None,
        'label': label,
      }

    # Extrair DOMINGO DD/MM que pode estar embutido em raw_plantao
    domingo_match = re.search(r'DOMINGO\s+(\d{2})/(\d{2})', raw_plantao)
    if domingo_match:
      dd, mm = domingo_match.groups()
      year = 2026  # ajustar se necessário
      key_dom = f"{year}-{mm}-{dd}"
      # Parse os dois horários na célula do Plantão Pago
      lines = raw_plantao.split('\n')
      hro_dom = None
      plantao_dom = None
      for line in lines:
        m1 = re.search(r'\(07 AS 15\)\s*(\w+)', line, re.I)
        if m1: hro_dom = m1.group(1).strip()
        m2 = re.search(r'\(15 AS 23\)\s*(\w+)', line, re.I)
        if m2: plantao_dom = m2.group(1).strip()
      entries[key_dom] = {
        'unimed': None,  # domingo nunca tem UNIMED
        'hro': hro_dom.title() if hro_dom else None,
        'plantaoPago': plantao_dom.title() if plantao_dom else None,
        'label': None,
      }

for k in sorted(entries.keys()):
  print(f"  '{k}': {entries[k]},")
```

### Notas importantes
- **Title-case** os nomes (não deixar `MARI` → deixar `Mari`).
- Labels de feriados conhecidos em 2026:
  - 03/04 Sexta-Feira Santa
  - 21/04 Tiradentes
  - 01/05 Dia do Trabalho
  - 04/06 Corpus Christi
  - 07/09 Independência · 12/10 Padroeira · 15/11 Proclamação · 25/12 Natal
  - Julho não tem feriado nacional — só FDS (`label: null` em tudo).
  - (verificar contra `FERIADOS_2026` / `FERIADO_LABELS` em `src/data/plantao2026.js`)
- Se o parser falhar em algum dia, reportar e pedir ao usuário para revisar o docx manualmente.

### Validações
- Cada sábado/feriado deve ter `unimed`, `hro`, `plantaoPago` todos preenchidos.
- Cada domingo deve ter `hro` e `plantaoPago` (unimed null).
- Se algum faltar, logar e perguntar antes de aplicar.

---

## 4. Atualizar `src/data/hospitaisTecnicas<ANO>.js`

Inserir/substituir entries no objeto `HOSPITAIS_2026` mantendo ordem cronológica.

Exemplo de bloco a inserir (adicionar junho):
```js
  // Maio 2026 (existente)
  '2026-05-31': { unimed: null, hro: 'Elisete', plantaoPago: 'Renata', label: null },
  // Junho 2026
  '2026-06-04': { unimed: 'Marta', hro: 'Renata', plantaoPago: 'Luciana', label: 'Corpus Christi' },
  '2026-06-06': { unimed: 'Saionara', hro: 'Elisete', plantaoPago: 'Mari', label: null },
  '2026-06-07': { unimed: null, hro: 'Elisete', plantaoPago: 'Mari', label: null },
  // ...
};
```

**Use `Edit` com contexto grande** para apontar onde inserir — não reescreva o arquivo inteiro.

---

## 5. Smoke test + deploy

**Antes de rodar o teste, atualize DUAS asserções** em `src/__tests__/data/hospitaisTecnicas2026.test.js` (ambas falham se esquecer uma):
1. `expect(Object.keys(HOSPITAIS_2026)).toHaveLength(N)` → novo total (anterior + dias importados).
2. A regex que valida as keys: `expect(key).toMatch(/^2026-(04|05|06|...)-\d{2}$/)` — **incluir o novo mês** no grupo. Ex.: ao importar julho, vira `(04|05|06|07)`. Esta é a pegadinha; sem ela o teste quebra com "Received 2026-07-04".

```bash
npm run test -- --run src/__tests__/data/hospitaisTecnicas2026.test.js
npm run build
git add src/data/hospitaisTecnicas2026.js src/__tests__/data/hospitaisTecnicas2026.test.js
git commit -m "feat(hospitais): importa FDS/feriados <MÊS>/<ANO> (<N> dias)"
git push origin main
rm -f .firebase/hosting.*.cache
firebase deploy --only hosting:anest-ap
```

> **Deploy precisa de autorização explícita do usuário.** O classificador de permissões bloqueia `firebase deploy` quando a skill foi invocada só com o arquivo — não é "pedido explícito de deploy". Faça commit+push, e então confirme com o usuário antes de deployar (ou peça que rode `! firebase deploy --only hosting:anest-ap`).

---

## 6. O que muda no app

- **Card "Técnicas de Enfermagem"** (Home + hub Escalas Funcionárias) passa a auto-preencher HRO/UNIMED/Plantão Pago nos FDS/feriados do novo mês.
- **Dias úteis**: card continua usando dados do Firestore `staff/schedule`.
- **MATERNO/Férias/Atestado**: continuam manuais via Firestore, em todos os dias.
- **Label "Func. Unimed"** fixo de 07–19h continua automático embaixo da funcionária da UNIMED.

---

## 7. Anomalias conhecidas
- Exportação do Numbers às vezes coloca o domingo dentro da célula do sábado. O script deve tratar isso extraindo `DOMINGO DD/MM` da coluna Plantão Pago.
- Nomes às vezes vêm com espaço extra ou em caixas mistas — sempre normalizar com `.strip().title()`.

## 8. Se esquecer
- Lista completa de skills: `CLAUDE.md` seção "Skills Disponíveis".
- Data canônica: `src/data/hospitaisTecnicas2026.js`.
- Testes: `src/__tests__/data/hospitaisTecnicas2026.test.js`.
