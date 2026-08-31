---
name: calculadoras
description: Regras para criar, editar e corrigir as calculadoras clínicas do ANEST (61 ativas em 14 seções, incluindo Indicação de UTI). Use ao mexer em calculator-definitions.js, nos displays do showcase, nas libs puras de src/lib, ou ao investigar conta errada, InfoBox, layout de grid e formatação de número.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Calculadoras Médicas ANEST

Consultadas por anestesiologistas **no celular, durante o ato anestésico**: conta errada é risco ao
paciente e tela confusa custa segundos que ninguém tem.

## Onde as coisas moram

⚠️ **`src/pages/calculadoras/` NÃO existe** — foi o caminho que esta skill e o agente
`calc-validator` apontaram por muito tempo, e enquanto isso qualquer busca voltava vazia parecendo
aprovação.

| onde | o que tem |
|---|---|
| `src/design-system/data/calculator-definitions.js` | **95 definições — 61 `active`, 34 `inactive`** — em 14 seções |
| `src/design-system/showcase/CalculatorShowcase.jsx` | a tela: grid, busca, inputs genéricos, 8 displays inline |
| `src/design-system/showcase/displays/` | 8 displays com arquivo próprio |
| `src/lib/*.js` | libs puras (`apacheII`, `fourScore`, `roxIndex`, `electrolyteCorrection`, `saps3`, `sofaScore`, `fluidBalance`…), testadas em `src/__tests__/lib/` |
| `src/data/criteriosUtiCalculators.js` + `src/pages/CriteriosUTIPage.jsx` | as **5 ferramentas de Indicação de UTI** — renderização própria, consumida pela seção via `customRender: 'criterioUti'` |
| `src/App.jsx:506` | o wrapper com `px-4 sm:px-5 py-4` |

Contar sempre pelo repo, nunca de memória:
`grep -c "status: 'active'" src/design-system/data/calculator-definitions.js`

## Propriedades especiais

- **`useDropdown: true` — 35 calculadoras** (não 9; a lista antiga só tinha as pediátricas).
  Para ver quais: `grep -B20 "useDropdown: true" … | grep "id:"`.
- **`customRender: '<chave>'` — 17 chaves distintas em 23 usos** (`hollidaySegar` serve duas; `criterioUti` serve as 5 da seção Indicação de UTI).
  8 têm arquivo em `displays/`; 8 são inline no `CalculatorShowcase.jsx`; `criterioUti` reaproveita a
  `CalculatorDetailPage` exportada da `CriteriosUTIPage` (lazy + Suspense local).

## Regras obrigatórias

### 1. Valores únicos em selects
Cada opção precisa de valor único. Quando dois itens valem o mesmo score, sufixe:
```javascript
options: [
  { value: 'choro_1', label: 'Sem choro' },
  { value: 'choro_2a', label: 'Gemido' },
  { value: 'choro_2b', label: 'Choro' },
]
```
O mapa valor→score fica na função de cálculo.

### 2. ⚠️ `parseFloat(x) || 0` DESCARTA O ZERO
`0` é falsy, então o `||` troca um valor digitado pelo default — em silêncio.

```javascript
// ARMADILHA: FR = 0 (apneia) vira 16 e a apneia deixa de pontuar
const fr = parseFloat(values.fr) || 16;

// CERTO: o zero é valor
const n = parseFloat(values.fr);
const fr = Number.isFinite(n) ? n : 16;
```

Custou 8 pontos de APACHE II em produção (FR = 0 e leucócitos = 0 valem +4 cada, e os dois inputs
têm `min: 0`) e, depois, a **classe IV do ATLS**: em `hemo_perdas_atls`, `diurese || 30` trocava
anúria por diurese normal e derrubava o paciente para classe I — o teste não pegava porque usava
`diurese: 2`, que passa pelo `||`. Só use `|| 0` quando zero for genuinamente equivalente a "campo
vazio" — peso, altura, dose. Nunca em variável fisiológica que pode ser zero.

Helper pronto no topo de `calculator-definitions.js`: `numeroOuPadrao(valor, padrao)`.

### 2b. ⚠️ Chave de mapa tem de bater LETRA POR LETRA com o `value` da opção
`value: 'liquido_claro'` contra a chave `líquido_claro` devolve `undefined`, o `compute` lança, e o
`catch { setResult(null) }` de `CalculatorShowcase.jsx:1974` engole — a opção fica **muda na tela**,
sem erro em lugar nenhum. Aconteceu em `ped_jejum`, na opção mais escolhida do card.
Quando o fallback do mapa por acaso vale o mesmo que a chave certa (`crianca`/`criança` em
`ped_mabl`), o número sai certo e o defeito fica latente até alguém mudar o default.
Trava genérica: `src/__tests__/data/calculatorOpcoesSelect.test.js`.

### 3. `risk` acende o badge de risco
`CalculatorShowcase.jsx:284` lê `result.risk`. Use quando o escore TEM estratificação clínica
(`baixo`/`medio`/`alto`/`critico` — 18 calculadoras usam); omita em conta pura, onde o badge é ruído.

### 4. Formato de warnings
`warnings: []` (array) no `infoBox`. O `warning:` string é formato legado já migrado.
⚠️ Não confundir com o `warning:` das drogas em `PEDI_CALC_DATA`, que é outro campo e é legítimo.

### 5. ⚠️ `toFixed()` escreve com PONTO — o app escreve com vírgula
`result.score.toFixed(2)` produz `12.75`, e a tela ao lado diz "1,5 mL/kg". Dois separadores na mesma
tela fazem duvidar da conta. Num app brasileiro o formato de número é tão português quanto as
palavras. Precedente de helper: `numeroBr` em `InibidoresApetiteDisplay.jsx`.
*(A migração dos ~133 usos é a Frente 4 de `docs/revisao-calculadoras.md`.)*

### 6. ⚠️ Prop errada na `Select` do DS é falha silenciosa
A `Select` aceita `options, value, onChange, placeholder, label, error, disabled, searchable, size,
className, id` e joga o resto num `<div>` via `{...props}`. Passar `onValueChange` (a prop do Radix,
não a do DS) não quebra nada: o dropdown abre, as opções aparecem — só o valor nunca chega ao estado.
Foi assim que a SAPS III ficou sem gravar nenhuma seleção. Trava:
`src/__tests__/design-system/select-props.test.js`.

## InfoBox — 5 seções visuais

| Seção | Cor | Ícone | Comportamento |
|-------|-----|-------|---------------|
| warnings | Vermelho (#DC2626) | AlertTriangle | Sempre visível, array |
| doses | Azul (#2563EB) | Pill | Sempre visível |
| keyPoints | Verde/Neutro | ChevronDown | Colapsável |
| interpretation | Verde (#059669) | Info | Sempre visível |
| reference | Cinza (#6B7280) | FileText | Sempre visível, discreto |

## Layout

- Padding do wrapper: `src/App.jsx:506` (`px-4 sm:px-5 py-4`).
- ⚠️ O `CalculatorShowcase` **tem** padding próprio: `px-2 pt-0 pb-3 lg:p-6` (`:1997`) — a regra
  antiga dizia "SEM padding próprio".
- Grid: 2 colunas, `gap-3 mt-3`, sem `ml-2`.
- Hierarquia: Header → SearchBar → SectionHeader (accordion) → Grid de WidgetCards.

## Conta nova ou corrigida entra com teste

Calculadora com matemática não-trivial põe a conta numa lib pura de `src/lib/` e a importa do
`compute` — como `uti_apache2`, `uti_four_score`, `uti_rox` e os eletrólitos fazem.

⚠️ **Lib sem importador de produção é pior que não ter teste**: a suíte fica verde sem cobrir a conta
que roda de verdade, e as duas implementações divergem sem nada acusar. Cinco libs ficaram assim e
duas tinham divergido. Confira com:
`grep -rl "lib/<nome>" src/ | grep -v __tests__ | grep -v "^src/lib/"`

Teste em `src/__tests__/lib/` (lib) ou `src/__tests__/data/` (definição), cobrindo os limites. E
**rode o teste novo contra o código ANTIGO antes de chamá-lo de trava** — teste que passa nos dois
lados não protege nada.

## Para criar nova calculadora

1. Definição em `calculator-definitions.js`, usando uma existente como molde.
2. `infoBox` com ao menos `interpretation` e `reference` (fonte primária citada).
3. Conferir o tratamento do zero em cada campo numérico (regra 2).
4. Testar em mobile (1 coluna) e desktop (2 colunas), nos dois temas.
5. Nada é apagado: calculadora descartada vira `status: 'inactive'`. **`LEGACY_ID_MAP` só para quem
   tem SUCESSORA ATIVA** — sem sucessora, inventar um destino é pior que não ter. E a seção
   "Favoritas" filtra inativas: sem isso, desativar não desativa para quem favoritou.
   ⚠️ **Ao inativar uma calculadora, conferir se ela é DESTINO de alguém no mapa.** Tirar o SAPS 3 em
   31/08/2026 quase deixou o `uti_apache2` apontando para card inativo — favorito abrindo tela que
   não existe mais. Trava genérica em `calculatorTriagem.test.js`.

## Uma calculadora fora da grade de Calculadoras

A Escala de Braden é `inactive` e mesmo assim tem tela: o card mora em `QualidadePage` e a rota
`escalaBraden` reusa o `CalculadorasPageWrapper` com `calcFixa="seg_braden"` e `titulo` próprio.
`getCalculatorById` resolve inativas de propósito, então o detalhe renderiza sem que ela volte à
grade. É o padrão para instrumento de acreditação que não é ato anestésico.

## Contagem de uso por calculadora

`App.jsx` passa `trackFeatureUse` como `onCalculatorOpen` ao `CalculadorasPageWrapper`, que dispara um
evento por abertura com o id cru da calculadora. ⚠️ **Não montar `useActivityTracking` dentro do
`CalculatorShowcase`** — o hook busca histórico e arma um intervalo de 5 min ao montar, e essa tela é
aberta durante a anestesia. Agregação: `node scripts/stats-uso-calculadoras.mjs`.
