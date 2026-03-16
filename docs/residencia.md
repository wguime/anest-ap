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
