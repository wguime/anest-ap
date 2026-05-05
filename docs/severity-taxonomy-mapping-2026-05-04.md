# Severity Taxonomy Mapping — ANEST → WHO ICPS / NCC MERP / NHS LFPSE

**Data:** 2026-05-04
**Tarefa:** B8 — Severity taxonomy WHO ICPS + NCC MERP
**Origem:** `src/data/incidentesConfig.js` (SEVERITY_LEVELS, linhas 129-175)

## 1. ANEST SEVERITY_LEVELS atual

| value | label | description |
|-------|-------|-------------|
| `near_miss` | Near Miss | Quase erro - interceptado antes de atingir o paciente |
| `leve` | Leve | Sem necessidade de intervenção adicional |
| `moderado` | Moderado | Necessitou intervenção adicional |
| `grave` | Grave | Prolongou internação ou causou dano permanente leve |
| `critico` | Crítico | Óbito ou dano permanente grave |

## 2. Padrões internacionais

### WHO ICPS — 4 classes
1. **Reportable Circumstance (RC)** — potencial significativo de dano, sem incidente.
2. **Near Miss (NM)** — não atingiu o paciente.
3. **No Harm Incident (NHI)** — atingiu, sem dano.
4. **Adverse Event (AE)** — atingiu, com dano (None / Mild / Moderate / Severe / Death).

### NCC MERP — 9 categorias (A-I, revisão Oct/2022)
| Cat | Definição |
|-----|-----------|
| A | Circunstância com capacidade de causar erro |
| B | Erro ocorreu mas não atingiu o paciente |
| C | Atingiu sem dano |
| D | Atingiu, requereu monitoramento/intervenção para evitar dano |
| E | Erro causou dano temporário + intervenção |
| F | Dano temporário + hospitalização prolongada |
| G | Dano permanente |
| H | Intervenção necessária para sustentar a vida |
| I | Óbito |

### NHS LFPSE — 5 graus de dano físico
- No Harm / Low Harm / Moderate Harm / Severe Harm / Death

## 3. Mapping table

| ANEST value | WHO ICPS | WHO Code | NCC MERP Cat | NHS LFPSE | Justificativa |
|---|---|---|---|---|---|
| `near_miss` | Near Miss | NM | B | No Harm | "interceptado antes de atingir" = WHO NM + NCC MERP B verbatim |
| `leve` | No Harm Incident | NHI | C | No Harm | "Sem intervenção adicional" = atingiu mas sem dano |
| `moderado` | Adverse Event | AE | D | Low Harm | "Necessitou intervenção" = NCC D (evitar dano) |
| `grave` | Adverse Event | AE | F | Moderate Harm | "Prolongou internação" → NCC F |
| `critico` | Adverse Event | AE | H ou I | Severe Harm or Death | Conflata óbito + dano permanente — ver gap #1 |

## 4. JS snippet — drop-in para `src/data/incidentesConfig.js`

Substituir o array `SEVERITY_LEVELS` atual por:

```js
export const SEVERITY_LEVELS = [
  {
    value: 'near_miss',
    label: 'Near Miss',
    description: 'Quase erro - interceptado antes de atingir o paciente',
    color: '#22C55E',
    bgColor: '#DCFCE7',
    darkBgColor: '#166534',
    icon: 'CircleDot',
    // International taxonomy mapping (B8 — 2026-05-04)
    whoIcpsClass: 'Near Miss',
    whoIcpsCode: 'NM',
    nccMerpCategory: 'B',
    nccMerpDescription: 'An error occurred but the error did not reach the patient',
    nhsLfpseHarm: 'No Harm',
  },
  {
    value: 'leve',
    label: 'Leve',
    description: 'Sem necessidade de intervenção adicional',
    color: '#EAB308',
    bgColor: '#FEF9C3',
    darkBgColor: '#854D0E',
    icon: 'AlertTriangle',
    whoIcpsClass: 'No Harm Incident',
    whoIcpsCode: 'NHI',
    nccMerpCategory: 'C',
    nccMerpDescription: 'An error occurred that reached the patient but did not cause patient harm',
    nhsLfpseHarm: 'No Harm',
  },
  {
    value: 'moderado',
    label: 'Moderado',
    description: 'Necessitou intervenção adicional',
    color: '#F97316',
    bgColor: '#FFEDD5',
    darkBgColor: '#9A3412',
    icon: 'AlertTriangle',
    whoIcpsClass: 'Adverse Event',
    whoIcpsCode: 'AE',
    nccMerpCategory: 'D',
    nccMerpDescription: 'An error occurred that reached the patient and required monitoring to confirm no harm and/or intervention to preclude harm',
    nhsLfpseHarm: 'Low Harm',
  },
  {
    value: 'grave',
    label: 'Grave',
    description: 'Prolongou internação ou causou dano permanente leve',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    darkBgColor: '#991B1B',
    icon: 'AlertOctagon',
    whoIcpsClass: 'Adverse Event',
    whoIcpsCode: 'AE',
    nccMerpCategory: 'F',
    nccMerpDescription: 'An error occurred that may have contributed to or resulted in temporary harm to the patient and required initial or prolonged hospitalization',
    nhsLfpseHarm: 'Moderate Harm',
  },
  {
    value: 'critico',
    label: 'Crítico',
    description: 'Óbito ou dano permanente grave',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    darkBgColor: '#7F1D1D',
    icon: 'Skull',
    whoIcpsClass: 'Adverse Event',
    whoIcpsCode: 'AE',
    // GAP: ANEST conflates "permanent severe harm" (G/H) with "death" (I).
    // Default to H (sustain-life intervention); flag for split — see docs.
    nccMerpCategory: 'H',
    nccMerpDescription: 'An error occurred that required intervention necessary to sustain life (or category I if death — recommend split)',
    nhsLfpseHarm: 'Severe Harm or Death',
  },
];
```

## 5. Gaps & recomendações

1. **`critico` conflata óbito + dano permanente grave.** Recomendar split: `critico` (Severe Harm, NCC G/H) e `obito` (Death, NCC I, LFPSE Death). Bloqueia tagging Never Events / Sentinel Events (B9).
2. **`grave` mistura temporário e permanente.** Manter mapeamento para F como base; considerar adicionar `tipoLesao` (`temporario|permanente`).
3. **Sem "Reportable Circumstance"** — adicionar nível `reportable_circumstance` acima de `near_miss` para hazards (equipamento indisponível antes do paciente).
4. **NCC MERP A** — sem mapeamento ANEST (intencional; equivalente conceitual = Reportable Circumstance, gap #3).
5. **NCC MERP E** — entre `moderado` (D) e `grave` (F). Aceitável; documentar que E-level fica em `moderado` até split fino.

## 6. Notas para `docs/incidentes-denuncias.md`

Adicionar seção:

```markdown
## Severity Taxonomy (B8 — 2026-05-04)
ANEST `SEVERITY_LEVELS` mapeia para 3 padrões internacionais:
- **WHO ICPS:** Near Miss / No Harm Incident / Adverse Event
- **NCC MERP** (Oct/2022): categorias B, C, D, F, H/I
- **NHS LFPSE:** No Harm / Low / Moderate / Severe / Death

Mapping completo: `docs/severity-taxonomy-mapping-2026-05-04.md`.

**Gaps conhecidos:**
- `critico` conflata "óbito" e "dano permanente grave" — recomendado split em `critico` + `obito`.
- Sem nível "Reportable Circumstance" para hazards.
```

## 7. Sources

- WHO ICPS — Conceptual Framework: https://iris.who.int/bitstream/handle/10665/70882/WHO_IER_PSP_2010.2_eng.pdf
- WHO ICPS — Key concepts: https://academic.oup.com/intqhc/article/21/1/18/1888152
- NCC MERP — Categorizing Medication Errors (Oct/2022): https://www.nccmerp.org/sites/default/files/2022ncc-merp-categorizing-medication-errors-index.pdf
- NHS LFPSE — Policy guidance: https://www.england.nhs.uk/long-read/policy-guidance-on-recording-patient-safety-events-and-levels-of-harm/
- NHS LFPSE — Data principles: https://record.learn-from-patient-safety-events.nhs.uk/data-principles
