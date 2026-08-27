---
name: importar-plantoes-residencia
description: Importar xlsx anual da escala de plantões dos residentes (365 dias × 1 plantonista + feriados anotados) e gerar `src/data/plantao<ANO>.js` automaticamente. Card "Plantão Residência" e página "Consultar Plantões" passam a refletir a nova escala com rollover das 7h.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Importar Plantões Residência — Nova Escala Anual

## Quando Usar
- Início de novo ciclo de residência (01/mar → 28/fev do ano seguinte).
- Usuário colocou `Residentes/<ANO> Escala.xlsx` na pasta.
- Precisa gerar/atualizar `src/data/plantao<ANO>.js` e fazer o app usar a nova escala.

> **IMPORTANTE**: esta skill é diferente da `/rotacao-residencia`. Aquela importa o **PDF de estágios** (rotações por quinzena). Esta importa o **xlsx de plantões** (calendário diário de quem dorme no hospital).

## Fluxo resumido
1. Ler xlsx anual.
2. Gerar `src/data/plantao<ANO>.js` com `PLANTOES_<ANO>`, `FERIADOS_<ANO>`, `FERIADO_LABELS` + helpers.
3. Migrar hook/consumo se for o **primeiro ano novo depois de 2026** (registry multi-ano).
4. Build + smoke test + deploy.

---

## 1. Ler o xlsx

Caminho esperado: `Residentes/<ANO> Escala.xlsx`.

### Estrutura do arquivo
- Exportado do Numbers (Apple). Cada sheet = um mês (ex: `março 2026`, `abril 2026`...).
- Cada sheet é um calendário visual:
  - Linha de cabeçalho com dias da semana (Domingo…Sábado).
  - Blocos de linhas por semana: primeira linha do bloco = datas (`datetime` Python), linha seguinte = nome do residente em **caixa alta**.
  - Células à direita das datas podem conter **label do feriado** (ex: `Tiradentes`, `Corpus Christi`, `Ano Novo`, `Sexta-Feira Santa`).
- Notas do mês aparecem em linhas finais (ignore: `APA:`, `FÉRIAS:`, `Notes:`, `OPTATIVO:`, `UTI:`).

Para extrair: usar **Bash** com Python + `openpyxl` (já instalado globalmente). Não usar `Read` direto — xlsx não é texto.

### Anomalias conhecidas (2026)
No xlsx de 2026 houve dois erros de digitação que precisaram ser normalizados:
- `2026-11-21: 'ROOSEVELTROOSEWELT'` → `r1-roosewelt`
- `2026-11-29: 'ROOSEVELT'` → `r1-roosewelt`

Para o novo ano, incluir normalizações similares no `NAME_TO_ID` só se o script apontar nomes não mapeados.

---

## 2. Identificar residentes e avanço de ano

Os residentes avançam um ano por ciclo. Exemplo 2026 → 2027:
- R1 Augusto → R2 Augusto (muda prefixo para `r2-augusto`)
- R1 Guilherme → R2 Guilherme
- R1 Roosewelt → R2 Roosewelt
- R2 Daniel → R3 Daniel
- R2 Jacinta → R3 Jacinta
- R2 Rodrigo → R3 Rodrigo
- R3 Raffaela → **formado, sai**
- R3 Wagner → **formado, sai**
- **3 novos R1** entram — pedir os nomes ao usuário se não aparecerem no xlsx.

**IDs estáveis**: manter a raiz (ex: `augusto`, `guilherme`) trocando só o prefixo `r1/r2/r3`. Isso preserva overrides em Firestore e match `firstName → residenteId` para resolver o usuário logado e disparar notificações de trocas corretamente.

---

## 3. Script Python de extração

Rodar via `python3 <<'EOF' ... EOF` no Bash. Estrutura canônica (copiar de `/tmp/` ou reescrever):

```python
import openpyxl, datetime
wb = openpyxl.load_workbook('Residentes/<ANO> Escala.xlsx', data_only=True)

NAME_TO_ID = {
  # Atualizar conforme avanço de ano:
  'AUGUSTO':'r2-augusto', 'GUILHERME':'r2-guilherme', 'ROOSEWELT':'r2-roosewelt',
  'DANIEL':'r3-daniel', 'JACINTA':'r3-jacinta', 'RODRIGO':'r3-rodrigo',
  # + os 3 novos R1 que o usuário informar
  'NOVO1':'r1-novo1', 'NOVO2':'r1-novo2', 'NOVO3':'r1-novo3',
}
EXCLUDE = {'Dia das Mães', 'Dia dos Pais', 'Páscoa'}  # comemorativos, não feriados legais

plantoes, feriados = {}, {}
for sheet in wb.sheetnames:
    if sheet == 'Resumo da Exportação': continue
    rows = list(wb[sheet].iter_rows(values_only=True))
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            if isinstance(cell, datetime.datetime):
                key = cell.strftime('%Y-%m-%d')
                if i + 1 < len(rows):
                    name = rows[i+1][j]
                    if isinstance(name, str):
                        rid = NAME_TO_ID.get(name.strip().upper())
                        if rid: plantoes[key] = rid
                if j + 1 < len(row):
                    label = row[j+1]
                    if isinstance(label, str):
                        lc = label.strip()
                        if lc and lc not in EXCLUDE:
                            feriados[key] = lc

# Validar: deve ter 365 (ou 366 se bissexto) entradas.
assert 364 <= len(plantoes) <= 367, f"Contagem inesperada: {len(plantoes)}"
```

Conferir no stdout antes de gerar o arquivo.

### Whitelist implícito de feriados
Qualquer label adjacente a uma datetime é capturado (menos o EXCLUDE). Na prática cobre: Sexta-Feira Santa, Tiradentes, Dia do Trabalho, Corpus Christi, Independência, N. S. Aparecida, Finados, Proclamação, Natal, Ano Novo, Carnaval, Consciência Negra, Dia do Município, além de "FERIADO" genérico (24/dez, 31/dez em 2026).

---

## 4. Gerar `src/data/plantao<ANO>.js`

Template canônico (espelho de `src/data/plantao2026.js`):

```js
/**
 * plantao<ANO>
 * Escala diária de plantão 01/mar/<ANO> → 28/fev/<ANO+1>.
 * Fonte: Residentes/<ANO> Escala.xlsx
 *
 * Regra:
 *   - Dias úteis: 12h (19h → 07h do dia seguinte)
 *   - Fins de semana e feriados: 24h (07h → 07h do dia seguinte)
 *
 * Rollover do card sempre às 07h.
 */
import { RESIDENTES_<ANO>, toDateKey } from './residencia<ANO>';

export const PLANTOES_<ANO> = {
  '<ANO>-03-01': 'r?-nome',
  // ... 365 entradas ordenadas
};

export const FERIADOS_<ANO> = new Set([
  '<ANO>-04-XX', // Sexta-Feira Santa
  // ...
]);

export const FERIADO_LABELS = {
  '<ANO>-04-XX': 'Sexta-Feira Santa',
  // ...
};

export function isPlantao24h(date) { /* idêntico a 2026 */ }
export function getHorarioPlantao(date) { /* idêntico a 2026 */ }
export function getPlantaoEfetivo(now = new Date()) { /* idêntico a 2026 */ }
export function getPlantaoParaData(date) { /* idêntico a 2026 */ }
```

O script Python gera todo o arquivo via string concatenation (ver histórico em `git log -p -- src/data/plantao2026.js`).

---

## 5. Registry multi-ano (se for o 2º ano ou mais)

**Primeira vez adicionando ano novo (ex: 2027)**: refatorar o dispatcher. Opções:

### Opção A — arquivo único dispatcher
Criar `src/data/plantao.js` (sem ano) que importa `plantao2026.js` e `plantao2027.js` e devolve o correto via date:

```js
import * as p2026 from './plantao2026';
import * as p2027 from './plantao2027';

const REGISTRY = [
  { inicio: '2027-03-01', mod: p2027 },
  { inicio: '2026-03-01', mod: p2026 },
];

function resolveMod(date) {
  const key = toDateKey(date);
  return REGISTRY.find((x) => key >= x.inicio)?.mod || REGISTRY[REGISTRY.length - 1].mod;
}

export function getPlantaoParaData(date) { return resolveMod(date).getPlantaoParaData(date); }
export function getPlantaoEfetivo(now)   { return (REGISTRY[0].mod).getPlantaoEfetivo(now); }
export function isPlantao24h(date)       { return resolveMod(date).isPlantao24h(date); }
export function getHorarioPlantao(date)  { return resolveMod(date).getHorarioPlantao(date); }
export const FERIADO_LABELS = { ...p2026.FERIADO_LABELS, ...p2027.FERIADO_LABELS };
export const FERIADOS_ALL = new Set([...p2026.FERIADOS_2026, ...p2027.FERIADOS_2027]);
```

E trocar imports em:
- `src/hooks/useResidencia.js` (usa `getPlantaoEfetivo`, `getPlantaoParaData`)
- `src/components/residencia/EditPlantaoModal.jsx` (`getPlantaoParaData`)
- `src/components/residencia/TradeRequestForm.jsx` (`PLANTOES_2026` — adaptar para dispatcher ou expor `PLANTOES_ALL`)
- `src/pages/ConsultaPlantoesPage.jsx` (`FERIADOS_2026`, `FERIADO_LABELS`, helpers)

### Opção B — atualizar referência direta
Se o novo ano substitui completamente o anterior (ex: nunca mais consulta 2026), basta trocar os imports de `./plantao2026` para `./plantao2027` nos mesmos arquivos. Mais simples, porém perde histórico.

Recomendar **Opção A** na skill.

---

## 6. Smoke test

```bash
cd "<project-root>" && node --input-type=module -e "
import('./src/data/plantao<ANO>.js').then(m => {
  const { getPlantaoParaData, getPlantaoEfetivo, isPlantao24h, PLANTOES_<ANO>, FERIADOS_<ANO> } = m;
  console.log('Plantões:', Object.keys(PLANTOES_<ANO>).length);
  console.log('Feriados:', FERIADOS_<ANO>.size);
  // 3 datas-amostra
  const p = getPlantaoParaData(new Date('<ANO>-03-10T12:00'));
  console.log('03/10:', p?.nome, p?.horario);
  const k = dt => getPlantaoEfetivo(new Date(dt)).toISOString().slice(0,10);
  console.log('rollover 06:59 → ontem:', k('<ANO>-04-15T06:59'));
  console.log('rollover 07:00 → hoje:', k('<ANO>-04-15T07:00'));
});
"
```

Deve listar número esperado (365/366) + plantonistas corretos.

---

## 7. Build + deploy (seguir AGENTS.md)

```bash
npm run build
git add -A
git commit -m "feat(plantoes): importa escala <ANO>"
git push origin main
firebase deploy --only hosting:anest-ap
```

---

## Caveats importantes

- **Override via troca**: usuários podem ter feito trocas de plantão que geram overrides em `residenciaPlantaoDiario/{YYYY-MM-DD}`. Esses permanecem válidos e se sobrepõem à tabela estática — não precisa limpar.
- **Mapeamento firstName → residenteId**: usado por `useTrocaPlantao` + notificações. Se mudar a raiz do ID (ex: `r3-raffaela` → `r3-raphaela` por renomeação), quebra o lookup. **Manter a raiz estável**.
- **Feriados regionais**: o xlsx é a fonte de verdade. Se o coordenador esquecer de anotar `Carnaval` ou `Consciência Negra`, o rollover daquele dia ficará errado (usará 19h em vez de 07h). Conferir visualmente a lista de feriados impressa no stdout do Python.
- **Ano bissexto**: fev do ano seguinte pode ter 29 dias — `assert 364 <= len(plantoes) <= 367` cobre os casos.
- **Supabase**: não há tabela para plantões — dados são 100% Firebase/código. Não precisa de migration.

## Referências
- Arquivo canônico: `src/data/plantao2026.js`
- Hook consumidor: `src/hooks/useResidencia.js`
- Página consulta: `src/pages/ConsultaPlantoesPage.jsx`
- Service de overrides: `src/services/residenciaPlantaoDiarioService.js`
- Card: `src/pages/HomePage.jsx` (busca "Plantão Residência")
- Feriados já extraídos em 2026: ver `FERIADOS_2026` e `FERIADO_LABELS` no `plantao2026.js` atual.
- Skill irmã: `rotacao-residencia` (importa PDF de estágios — diferente deste).
