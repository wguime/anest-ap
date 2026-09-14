# Residência Médica — ANEST

## Páginas
| Página | Arquivo | Descrição |
|--------|---------|-----------|
| GerenciarResidenciaPage | GerenciarResidenciaPage.jsx | Admin — gestão de residentes e plantão |
| ResidenciaHubPage | ResidenciaHubPage.jsx | Hub com cards (Trocas de Plantão, Assistente IA em standby) |
| TrocasPlantaoPage | TrocasPlantaoPage.jsx | Trocas de plantão entre residentes |

## Features
- Listar residentes em tabela editável
- CRUD residentes (nome, ano R1/R2/R3, rodízio, cirurgião)
- Gerenciar plantão de residência
- Trocas de plantão (role-based: todos veem, só residente cria)

## Arquitetura
```
GerenciarResidenciaPage.jsx
└── useResidencia (hook)
    ├── residentes (array), plantao (current)
    ├── saveEstagios() → Firestore
    ├── savePlantao() → Firestore
    ├── canEdit (permission check)
    ├── connectionStatus (connected/reconnecting/error)
    └── error handling toast + retry backoff
└── residenciaService.js
    ├── getEstagios() → residencia/estagios
    ├── updateEstagios()
    ├── getPlantao() → residencia/plantao
    ├── updatePlantao()
    └── createFirestoreSubscription (real-time)
```

## Trocas de Plantão (v3.34.0)
- `useTrocaPlantao.js`: helpers `isResidente(user)`, `canManageTrades(user)`
- `trocaPlantaoService.js`: CRUD + `solicitanteRole`/`solicitanteAno`
- Guard: só `medico-residente` OU admin pode criar
- Não-residentes: FAB oculto, botões aceitar/rejeitar disabled
- Banner informativo para não-residentes

## ResidenciaHubPage (v3.33.1)
- Card "Trocas de Plantão" full-width (grid-cols-1)
- Card "Assistente IA" em standby (comentado — Edge Function deploy pendente)

## Firestore Collections
- `residencia/estagios` — Lista de residentes com estágios
- `residencia/plantao` — Plantão atual do residente
- `residenciaPlantaoDiario/{YYYY-MM-DD}` — override do residente do dia (`residenteOverride`,
  `origem: 'troca'|'manual'`, `trocaId`). Aceitar troca grava 1 (cobertura) ou 2 (swap) docs.

## Escala EFETIVA = tabela + overrides (v5.12.4, 14/09/2026)
A escala dos residentes é a tabela estática `PLANTOES_2026` (`src/data/plantao2026.js`); toda troca
aceita ou ajuste manual vira override em `residenciaPlantaoDiario`. **Ler a tabela direto é ler a
escala de ANTES das trocas** — foi assim que, em julho/2026, quem trocou o dia 20 pelo 19 continuou
marcado no 20 em "Consultar Plantões" (o detalhe do dia lia o override; as bolinhas, não).

- `getResidenteEfetivo(dateKey, overrides)` / `getDatasDoResidente(id, overrides)` — as únicas
  funções que respondem "de quem é o plantão". Overrides vêm de `useResidenciaPlantaoOverrides()`
  (`src/hooks/useOverridesDiario.js`, coleção inteira em tempo real; mesmo desenho do
  `useHospitaisOverrides`).
- Formulário de troca: destinatário auto-selecionado e validação (`src/lib/trocaResidenciaValidacao.js`)
  julgam pela escala efetiva; não se oferece um dia que já foi cedido.
- **Lembretes "Plantão amanhã" vêm da edge `schedule-shift-reminders` (pg_cron 3×/dia), que NÃO lê
  Firestore:** ela consulta `residencia_plantao_diario_overrides` (Supabase) e cai na tabela sem a
  linha. A tabela só existe desde a migration `20260914150000`; toda escrita no Firestore é espelhada
  por `src/services/residenciaPlantaoOverridesMirror.js` (best-effort — falha não desfaz a troca, só
  avisa no console). O hook `useResidenteShiftReminders` (admin, client-side) lê o Firestore; os dois
  produzem o mesmo `related_entity_id`, então a dedup do banco segura a duplicata quando concordam.
  Sinal de drift: dois residentes com "Plantão amanhã" para o mesmo dia em `notifications`
  (`related_entity_type = 'plantao-residencia'`).

## Badge por Ano
R1 = azul | R2 = laranja | R3 = verde

## Home Cards
- "Estágios Residência" — EditEstagiosModal (max-h-[60vh], xl)
- "Plantão Residência" — dados do plantão atual

## Integração
- Centro de Gestão → aba Residência (lista R1/R2/R3, edição, plantões)
- Educação → módulos por tipo de usuário (medico-residente)
- BottomNav → menu tab → gerenciarResidencia
- Comitê Educação → "Educação e Residência"
