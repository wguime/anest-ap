---
name: rotacao-residencia
description: Importar PDF anual de rotação dos residentes (24 quinzenas × 8 residentes) e gerar arquivo de dados automaticamente usado pelo card "Estágios Residência". Rollover 12h/19h é automático.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Rotação Residência — Importar Nova Escala Anual

## Quando Usar
- Início de novo ciclo de residência (tipicamente 01/mar → 28/fev).
- Usuário colocou PDF em `Residentes/<ANO> Estágios.pdf`.
- Precisa gerar/atualizar `src/data/residencia<ANO>.js` e garantir que o card usa os novos dados.

## Fluxo Resumido
1. Ler PDF anual.
2. Gerar `src/data/residencia<ANO>.js` com `RESIDENTES_<ANO>` e `ROTACOES_<ANO>`.
3. Garantir que o hook `useResidencia` lê a tabela do ano correto (registry).
4. Build + smoke tests + deploy.

---

## 1. Ler o PDF

Caminho esperado: `Residentes/<ANO> Estágios.pdf` (ex: `Residentes/2027 Estágios.pdf`).

Usar a tool **Read** no arquivo PDF — o Codex extrai a tabela nativamente.

### Estrutura esperada do PDF
- **Linhas** = quinzenas no formato `01-15/mmm` ou `16-DD/mmm` (DD = 28/29/30/31).
- **Colunas** = nomes dos residentes (8 no total, 3 R1 + 3 R2 + 2 R3, ou variação).
- **Cabeçalho da coluna** na ordem que aparece no PDF (ex: Wagner, Raffaela, Daniel, …).
- **Células** = string do estágio em caixa alta (ex: TORÁCICA, APA, GO/EMERG, CX GERAL, FÉRIAS, UNIMED, IMAGEM/BRAQUI).

Se o PDF cobrir março-do-ano-X até fevereiro-do-ano-(X+1), o arquivo recebe o nome do **ano inicial** (ex: `residencia2027.js` cobre 03/2027–02/2028).

---

## 2. Identificar Residentes e Ano (R1/R2/R3)

Os residentes avançam ano a ano. Exemplo 2026 → 2027:
- R1 Augusto → R2 Augusto
- R1 Guilherme → R2 Guilherme
- R1 Roosewelt → R2 Roosewelt
- R2 Daniel → R3 Daniel
- R2 Jacinta → R3 Jacinta
- R2 Rodrigo → R3 Rodrigo
- R3 Raffaela → **formado, sai** da lista
- R3 Wagner → **formado, sai** da lista
- Novos R1: 3 nomes (pedir ao usuário se não estiverem no PDF)

**IDs estáveis**: formar `r<ano>-<nome-lowercase-sem-acento>`. Ex: `r1-joao`, `r2-maria`. Usar os mesmos IDs para o mesmo residente ao longo dos anos, senão overrides em Firestore apontam para pessoa errada. Apenas mudar o prefixo `r1/r2/r3` conforme o residente avança.

**Se o ano do residente (R1/R2/R3) não estiver explícito no PDF**, perguntar ao usuário via AskUserQuestion antes de gerar o arquivo.

---

## 3. Criar `src/data/residencia<ANO>.js`

Template (copiar de `src/data/residencia2026.js` — que já existe como referência canônica):

```js
/**
 * residencia<ANO>
 * Tabela estática da rotação de residentes em <ANO>
 * (01/mar/<ANO> → 28/fev/<ANO+1>).
 * Fonte: Residentes/<ANO> Estágios.pdf
 */

export const RESIDENTES_<ANO> = [
  { id: 'r1-<nome1>', nome: '<Nome1>', ano: 'R1' },
  // ... 8 residentes
];

// Helper para criar quinzena (colunas na MESMA ORDEM do PDF)
const q = (<col1>, <col2>, ..., <col8>) => ({
  '<id-col1>': <col1>,
  '<id-col2>': <col2>,
  // ...
});

export const ROTACOES_<ANO> = [
  { inicio: '<ANO>-03-01', fim: '<ANO>-03-15', estagios: q('TORÁCICA', ...) },
  { inicio: '<ANO>-03-16', fim: '<ANO>-03-31', estagios: q('SRPA', ...) },
  // ... 24 entradas até '<ANO+1>-02-28' (ou 02-29 se ano bissexto)
];
```

### Regras ao gerar
- **Manter strings do PDF exatamente** (inclui variações tipo `CX GERAL` vs `CX/GERAL`, `FERIAS` vs `FÉRIAS`). `formatEstagio` normaliza apresentação.
- **Datas fim de mês**: mar/mai/jul/ago/out/dez terminam em 31; abr/jun/set/nov em 30; fev em 28 (ou 29 se ano-seguinte bissexto).
- **24 entradas**: mar × 2 + 11 outros meses × 2 = 24. Validar contagem.
- **Validação automática**: após gerar, rodar `node -e` para conferir que `getEstagiosParaData` bate em 3 datas aleatórias do PDF.

---

## 4. Integração — Registry de Anos

O hook `src/hooks/useResidencia.js` importa do módulo canônico. Para suportar múltiplos anos sem quebrar o ano atual:

### Opção A — Primeira vez adicionando ano novo (ex: 2027)
Refatorar `src/data/residencia2026.js` para virar **registry dispatcher**:

1. Mover helpers compartilhados (`getSlotEfetivo`, `slotKey`, `toDateKey`, `formatEstagio`) para um bloco comum no próprio arquivo — já estão lá.
2. Adicionar importação do novo ano e lógica de dispatch:

```js
import { RESIDENTES_2027, ROTACOES_2027 } from './residencia2027';

// Registry ordenado por data de início (mais novo primeiro)
const ROTACOES_POR_ANO = [
  { inicio: '2027-03-01', RESIDENTES: RESIDENTES_2027, ROTACOES: ROTACOES_2027 },
  { inicio: '2026-03-01', RESIDENTES: RESIDENTES_2026, ROTACOES: ROTACOES_2026 },
];

function getAnoParaData(date) {
  const key = toDateKey(date);
  return ROTACOES_POR_ANO.find(a => key >= a.inicio) || ROTACOES_POR_ANO[ROTACOES_POR_ANO.length - 1];
}

export function getQuinzenaParaData(date) {
  const key = toDateKey(date);
  const ano = getAnoParaData(date);
  return ano.ROTACOES.find(r => key >= r.inicio && key <= r.fim) || null;
}

export function getEstagiosParaData(date) {
  const ano = getAnoParaData(date);
  const quinzena = getQuinzenaParaData(date);
  return ano.RESIDENTES.map((r) => {
    const raw = quinzena ? (quinzena.estagios[r.id] || null) : null;
    return { ...r, estagio: raw ? formatEstagio(raw) : null };
  });
}
```

3. **NÃO mudar** o hook `useResidencia.js` — ele continua importando do mesmo lugar.
4. Manter `RESIDENTES_2026` exportado (hook usa como fallback).

### Opção B — Ano subsequente (quando registry já existe)
Apenas adicionar nova entrada no array `ROTACOES_POR_ANO` no topo (mais novo primeiro).

---

## 5. Validação

### Smoke test obrigatório
Rodar antes do deploy:

```bash
cd "<project-root>" && node --input-type=module -e "
import('./src/data/residencia2026.js').then(m => {
  const { getEstagiosParaData, getSlotEfetivo, slotKey, formatEstagio } = m;
  const checks = [
    // 3 datas-chave do NOVO ano para conferir que a tabela bate com o PDF
    { date: '<ANO>-03-10T14:00', expect: { <Nome>: '<estagio esperado formatado>' } },
    { date: '<ANO>-06-20T14:00', expect: { <Nome>: '<estagio esperado formatado>' } },
    { date: '<ANO+1>-01-20T14:00', expect: { <Nome>: '<estagio esperado formatado>' } },
  ];
  let pass = 0, fail = 0;
  for (const c of checks) {
    const got = Object.fromEntries(getEstagiosParaData(new Date(c.date)).map(r => [r.nome, r.estagio]));
    for (const [nome, estagio] of Object.entries(c.expect)) {
      if (got[nome] === estagio) { pass++; console.log('✓', c.date, nome, '=', estagio); }
      else { fail++; console.log('✗', c.date, nome, 'got', got[nome], 'expected', estagio); }
    }
  }
  // Rollover boundaries
  const keyOf = dt => slotKey(getSlotEfetivo(new Date(dt)));
  console.log('Rollover 31/mar 19:30 →', keyOf('<ANO>-03-31T19:30'), '(esperado <ANO>-04-01-manha)');
  process.exit(fail ? 1 : 0);
});
"
```

### Build
```bash
npm run build
```
Deve terminar com `✓ built in Xs`.

### Lint (arquivos modificados)
```bash
npx eslint src/data/residencia<ANO>.js src/data/residencia2026.js
```

---

## 6. Deploy (seguir AGENTS.md)

1. `npm run build`
2. `git add src/data/residencia<ANO>.js src/data/residencia2026.js`
3. `git commit -m "feat(residencia): importa escala <ANO>"`
4. `git push origin main`
5. `firebase deploy --only hosting:anest-ap`

---

## Caveats Importantes

- **Firestore overrides**: usuários podem ter editado cirurgião/estágio em dias específicos. Esses docs (`residenciaEstagiosDiarios/{YYYY-MM-DD}-{manha|tarde}`) continuam válidos e sobrepõem a tabela base.
- **IDs de residente**: se um residente mudar de ID entre anos, os overrides antigos não migram. Manter IDs estáveis (só prefixo R1/R2/R3 muda).
- **Estágios novos no PDF**: se o PDF novo trouxer string inédita (ex: `DOR`, `CARDIO`), `formatEstagio` já lida automaticamente (first-letter-cap por palavra, com APA/GO preservados). Não precisa adicionar regras novas.
- **Data Brasil (BRT, UTC-3)**: o hook usa `new Date()` local do browser. Em produção isso é o horário do usuário — consistente se todos estiverem no Brasil.
- **Rollover automático**: não mexer em `getSlotEfetivo` — a lógica 00h/12h/19h é fixa e independente do ano.

## Referências
- Arquivo canônico: `src/data/residencia2026.js`
- Hook consumidor: `src/hooks/useResidencia.js`
- Service Firestore overrides: `src/services/residenciaEstagiosDiariosService.js`
- Modal de edição: `src/components/residencia/EditEstagiosModal.jsx`
- Card home: `src/pages/HomePage.jsx` (busca "Estágios Residência")
