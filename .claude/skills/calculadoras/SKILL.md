---
name: calculadoras
description: Regras para criar/editar calculadoras clínicas médicas (76+). InfoBox 5 seções, formatação, layout grid.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Calculadoras Médicas ANEST

## Quando Usar
Criar nova calculadora, editar existente, corrigir bugs de cálculo/layout.

## Arquivos Principais
- Definições: `src/data/calculadoras.js`
- Showcase: `src/pages/CalculatorShowcase.jsx`
- Wrapper: `src/App.jsx` (padding px-4 sm:px-5 py-4)

## Propriedades Especiais
- `useDropdown: true` — 9 calcs (ped_glasgow, ped_steward, ped_pews, ped_psofa, ped_pim3, ped_prism3, ped_flacc, ped_cheops, ped_perdas_sang)
- `customRender: 'string'` — 5 calcs (pedicalc, via_aerea, desfibrilacao, fita_broselow, ped_holliday_segar)

## Regras Obrigatórias

### 1. Valores Únicos em Selects
Cada opção DEVE ter valor string único. Usar sufixo quando scores se repetem:
```javascript
options: [
  { value: 'choro_1', label: 'Sem choro' },
  { value: 'choro_2a', label: 'Gemido' },
  { value: 'choro_2b', label: 'Choro' },
]
```
O mapeamento de valor→score fica na função de cálculo.

### 2. ParseFloat Obrigatório
```javascript
const peso = parseFloat(values.peso) || 0;
```

### 3. SEM Propriedade `risk`
Retornar apenas `score` e `details`. A propriedade `risk` gera badge indesejado.

### 4. Formato warnings (array)
Usar `warnings: []` (array), NUNCA `warning:` (string — formato legado migrado).

### 5. Score com 2 decimais
```javascript
result.score.toFixed(2)
```

## InfoBox — 5 Seções Visuais

| Seção | Cor | Ícone | Comportamento |
|-------|-----|-------|---------------|
| warnings | Vermelho (#DC2626) | AlertTriangle | Sempre visível, array |
| doses | Azul (#2563EB) | Pill | Sempre visível |
| keyPoints | Verde/Neutro | ChevronDown | Colapsável |
| interpretation | Verde (#059669) | Info | Sempre visível |
| reference | Cinza (#6B7280) | FileText | Sempre visível, discreto |

## Layout
- Padding: SOMENTE no wrapper App.jsx (`px-4 sm:px-5 py-4`)
- CalculatorShowcase: SEM padding próprio
- Grid: 2 colunas, `gap-3 mt-3`, SEM `ml-2`
- Hierarquia: Header → SearchBar → SectionHeader (accordion) → Grid WidgetCards

## Integrações
- Critérios UTI referencia escalas médicas
- ShowcaseIndex para listagem no Menu
- WidgetCard para cards individuais

## Para Criar Nova Calculadora
1. Adicionar definição em `src/data/calculadoras.js`
2. Seguir estrutura de calculadora existente como template
3. Incluir InfoBox com pelo menos `interpretation` e `reference`
4. Testar parseFloat em todos os campos numéricos
5. Verificar layout em mobile (1 col) e desktop (2 cols)
