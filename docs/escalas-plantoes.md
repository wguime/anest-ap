# Escalas e Plantões — ANEST

## Integração API Pega Plantão v1.7
- OAuth 2.0, cache 5min
- Service: `src/services/pegaPlantaoApi.js`
- Hook: `src/hooks/usePegaPlantao.js` → `useEscalaDia()`

## Hook useEscalaDia() Returns
- `plantoesManha` / `plantoesTarde` / `plantoes` (combined)
- `plantoesFDS` (deduplicated by sector P1-P11 weekends)
- `ferias` (weekdays only)
- `isWeekend` (Sat 7h → Mon 7h)
- `periodoAtual` ('manha' | 'tarde')
- `expanded`, `toggleExpanded`, `loading`, `error`, `usandoMock`, `refetch`

## Shift Data Structure
```javascript
{ setor: 'P1', hospital: 'Name', data: 'P1 - Diurno', hora: '07:00', bgColor: '#B8E0C8' }
```

## Regra 24h (HORA_CORTE_PLANTAO = 7)
| Momento | isWeekendMode | API Date | Setores | Férias |
|---------|---------------|----------|---------|--------|
| Sáb 00-06:59 | false | Sexta | P1-P4 (Night) | Sim |
| Sáb 07:00+ | true | Sábado | P1-P11 | Não |
| Dom inteiro | true | Sábado | P1-P11 | Não |
| Seg 00-06:59 | true | Sábado | P1-P11 | Não |
| Seg 07:00+ | false | Segunda | P1-P4 (Night) | Sim |
| Ter-Sex | false | Dia atual/anterior | P1-P4 (Night) | Sim |

## Setores
- Dias úteis: P1, P2, P3, P4
- Fim de semana: P1-P11

## Férias
Extraídas do API onde `Setor = "Férias"`.

## Vite Proxy (Dev)
Em `vite.config.js`:
```javascript
'/api/pegaplantao': {
  target: 'https://www.pegaplantao.com.br',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/pegaplantao/, ''),
}
```

## Páginas
- `HomePage.jsx` — Card Plantões (max 4 items)
- `EscalasPage.jsx` — Escala completa

---

# Escalas Internas 2026 (tabelas estáticas + overrides Firestore)

Além da integração Pega Plantão (anestesistas), o app gerencia 3 escalas internas com sistema de trocas:

| Escala | Quem | Base estática | Override Firestore | Código de troca |
|--------|------|---------------|--------------------|--------------------|
| Plantão Residência | 8 residentes | `src/data/plantao2026.js` (`PLANTOES_2026`) | `residenciaPlantaoDiario/{YYYY-MM-DD}` | `TR#####` |
| Sobreaviso Materno | 6 funcionárias | `src/data/sobreavisoMaterno2026.js` (`SOBREAVISO_MATERNO_2026`) | `sobreavisoMaternoDiario/{YYYY-MM-DD}` | `SB#####` |
| Plantão Hospitalar FDS/Feriado | 6 funcionárias | `src/data/hospitaisTecnicas2026.js` (`HOSPITAIS_2026`) | `hospitaisDiario/{data}_{hospital}_{turno}` | `PH#####` |

Padrão comum: **tabela estática (fonte da verdade) + doc de override por dia** — a escala exibida é sempre `override ?? base`. Trocas nunca editam a tabela; só gravam overrides.

## Trocas de Plantão Hospitalar (FDS/Feriados) — PH#####

Plantões de técnicas de enfermagem em finais de semana e feriados, 3 slots por data:

| Slot | Turno | Dias |
|------|-------|------|
| HRO | manhã (07h–15h) | sábados, domingos, feriados |
| UNIMED | manhã (07h–15h) | sábados e feriados (domingo NÃO tem) |
| Plantão Pago | tarde (15h–23h) | sábados, domingos, feriados |

- Service: `src/services/trocaPlantaoHospitalarService.js` — coleção `trocas_plantao_hospitalar`
- Hook: `src/hooks/useTrocaPlantaoHospitalar.js`
- Página: `src/pages/TrocasPlantaoHospitalarPage.jsx` (case `trocasPlantaoHospitalar` no App.jsx)

**Escopo da troca** (exclusivo deste módulo):
- `slot` — troca um único slot (hospital + turno + data). Exige `hospital` e `turno`; no swap, exige também `hospitalDesejado`/`turnoDesejado`.
- `dia` — troca TODOS os slots da data em que a solicitante está escalada (`slotsDaFuncionariaNaData()` resolve a lista a partir de `HOSPITAIS_2026`).

**Modos** (combinam com escopo): cobertura (unidirecional, só `dataPlantao`) ou swap bidirecional (`dataPlantao` + `dataDesejada`, exige destinatária específica).

**Validações no `createTradeRequest`/`acceptTrade`:**
- Solicitante deve estar escalada na data/slot ("Você não está escalada nessa data/neste slot").
- Aceitadora não pode ter conflito no mesmo slot da data (escopo slot).
- Troca direcionada (`destinatarioId`) só pode ser aceita pela destinatária.
- Solicitante não aceita/rejeita a própria troca; só ela cancela.

**Ao aceitar** (`writeBatch` atômico): atualiza status da troca + grava 1 override por slot transferido em `hospitaisDiario/{data}_{hospital}_{turno}`; no swap, grava também os overrides de retorno na `dataDesejada`.

## Trocas de Sobreaviso Materno — SB#####

Sobreaviso de enfermagem materno, sempre 12h (19h→07h), 1 funcionária por dia (abr–jun/2026).

- Service: `src/services/trocaSobreavisoService.js` — coleção `trocas_sobreaviso`
- Hook: `src/hooks/useTrocaSobreaviso.js` (exporta `canManageTrades`, reutilizado pelo módulo hospitalar)
- Página de trocas: `src/pages/TrocasSobreavisoPage.jsx` (case `trocasSobreaviso`)
- Página de consulta: `src/pages/ConsultaSobreavisoPage.jsx` (case `consultaSobreaviso`) — calendário aberto a qualquer usuário autenticado; marca feriados (bolinha amarela) e dias da funcionária logada (bolinha azul); aplica override de `sobreavisoMaternoDiario` na data selecionada e mostra também os slots hospitalares do dia quando for FDS/feriado.

Mesma máquina de estados das demais trocas (cobertura/swap, validações, batch atômico). Ao aceitar: override em `sobreavisoMaternoDiario/{dataSobreaviso}` → aceitadora; no swap, `{dataDesejada}` → solicitante.

**Permissão (`canManageTrades`):** funcionária identificada por email nas listas estáticas (`isFuncionariaPorEmail`) **ou** `role === 'tec-enfermagem'` com permission `sobreaviso-materno` **ou** admin/coordenador. Admin/coord pode criar troca "em nome de" uma funcionária via `solicitanteFuncionariaIdOverride` (funcionárias sem conta).

## Trocas de Plantão da Residência — TR#####

- Service: `src/services/trocaPlantaoService.js` — coleção `trocas_plantao`
- Hook: `src/hooks/useTrocaPlantao.js`
- Página: `src/pages/TrocasPlantaoPage.jsx` (case `trocasPlantao`)
- Override ao aceitar: `residenciaPlantaoDiario/{dataPlantao}` (+ `{dataDesejada}` no swap)

## Ciclo de vida de uma troca (3 módulos)

```
pendente ──aceita──→ aceita (grava overrides em batch atômico)
   ├──rejeitada──→ rejeitada (só quem não é solicitante)
   └──cancelada──→ cancelada (só solicitante)
```

Campos do doc de troca: `codigo`, `solicitanteId` (Firebase UID), `solicitante{Nome,Role,FuncionariaId|ResidenteId}`, datas, `descricao`, `destinatarioId` (id da escala, não UID — null = aberta a todos), `respondidoPor{Id,Nome,FuncionariaId|ResidenteId}`, `status`, `criadoEm`/`atualizadoEm`/`respostaEm`.

`subscribeTrades(userId, getId, callback)` — listener real-time único que deriva `myTrades` (sou solicitante, respondi, ou sou destinatária) e `pendingForMe` (pendentes abertas ou direcionadas a mim). `getId` é função (ref) para o id da escala mudar sem re-subscrever.

## Views Admin (read-only)

- `src/pages/AdminTodasTrocasFuncionariasPage.jsx` (case `adminTodasTrocasFuncionarias`) — 2 tabs (Sobreaviso | Plantão Hospitalar) com contadores; TODAS as trocas de todas as funcionárias.
- `src/pages/AdminTodasTrocasResidenciaPage.jsx` (case `adminTodasTrocasResidencia`) — todas as trocas de residência.
- Hooks: `src/hooks/useAllTrades.js` (`useAllSobreavisoTrades` / `useAllPlantaoHospitalarTrades` / `useAllResidenciaTrades`) → `subscribeAllTrades` de cada service, SEM filtro de usuário.
- Gate de acesso aplicado no Hub que renderiza o card (não na página).

## Mecânica de Overrides Diários

| Coleção | Doc ID | Campo de override | Service |
|---------|--------|-------------------|---------|
| `residenciaPlantaoDiario` | `YYYY-MM-DD` | `residenteOverride` | `src/services/residenciaPlantaoDiarioService.js` |
| `sobreavisoMaternoDiario` | `YYYY-MM-DD` | `funcionariaOverride` | `src/services/sobreavisoMaternoService.js` |
| `hospitaisDiario` | `YYYY-MM-DD_{hospital}_{turno}` (hospital ∈ hro\|unimed\|plantao_pago, turno ∈ manha\|tarde) | `funcionariaOverride` | escrito por `trocaPlantaoHospitalarService.js`; lido via `getHospitaisEfetivos()` |
| `residenciaEstagiosDiarios` | `YYYY-MM-DD-{manha\|tarde}` (slotKey) | `estagiosOverride` (map) + `cirurgiaos` | `src/services/residenciaEstagiosDiariosService.js` |

Shape do doc de override de plantão/sobreaviso:
```javascript
{
  residenteOverride | funcionariaOverride: 'r2-daniel' | 'marta',  // id da lista estática
  origem: 'manual' | 'troca',     // manual = editado por admin; troca = gravado no acceptTrade
  trocaId: 'PH123456',            // só quando origem === 'troca' (código, não doc id)
  updatedAt: serverTimestamp(),
  updatedBy: userId,              // Firebase UID real (audit trail)
}
```

Regras:
- `updateXDiario(dateKey, payload, userId)` com override null/undefined → **deleta o doc** (volta à escala estática).
- `batchUpdateXsDiarios(entries, userId)` — escrita atômica múltipla (swap bidirecional).
- Aplicação na leitura: `getHospitaisEfetivos(date, overrides)` e `getSlotsFuncionariaNaData(id, dateKey, overrides)` em `src/data/hospitaisTecnicas2026.js`; `getDatasDaSobreavisista(id, fromDateKey, overrides)` em `src/data/sobreavisoMaterno2026.js`.

## Resolução de Identidade por Email

Não há FK entre contas Firebase e escalas — o vínculo é por **email** contra as listas estáticas:

| Lista | Arquivo | Shape |
|-------|---------|-------|
| `RESIDENTES_2026` | `src/data/residencia2026.js` | `{ id: 'r2-daniel', nome, ano: 'R1'\|'R2'\|'R3', email }` |
| `FUNCIONARIAS_SOBREAVISO` | `src/data/sobreavisoMaterno2026.js` | `{ id: 'marta', nome, cargo, email }` |
| `FUNCIONARIAS_HOSPITAIS` | `src/data/hospitaisTecnicas2026.js` | `{ id: 'marta', nome, email }` (mesmas 6 funcionárias) |

- Resolver compartilhado: `src/utils/funcionariaResolver.js` — `resolveFuncionariaId(user, lista)` (match por email normalizado; loga warn 1x por email não encontrado) e `isFuncionariaPorEmail(user)` (checa as 2 listas de funcionárias).
- Residência: `resolveResidenteId` em `useTrocaPlantao.js` — match **APENAS por email** (firstName colide: dois "Guilherme").
- **Caches module-level** (`Map`, vivem a sessão inteira): `residenteIdToUidCache` e `funcionariaIdToUidCache` mapeiam id da escala → Firebase UID, populados 1x via query em `users` (`role == 'medico-residente'` / `role == 'tec-enfermagem'`; sobreaviso filtra ainda `permissions['sobreaviso-materno']`). Usados para resolver `recipientIds` das notificações: `getResidenteFirebaseUid()`, `getFuncionariaFirebaseUid()`, `getFuncionariaHospitalarFirebaseUid()`.
- Conta não vinculada: banner de aviso na página de trocas ("sua conta ainda não foi vinculada à escala").

## Recomputação Temporal (rollovers)

| Card | Função | Regra |
|------|--------|-------|
| Plantão residência | `getPlantaoEfetivo()` (`plantao2026.js`) | rollover **07h**: antes das 07h → ontem; depois → hoje |
| Sobreaviso materno | `getSobreavisoEfetivo()` (`sobreavisoMaterno2026.js`) | rollover **07h** (sobreaviso é 19h→07h) |
| Hospitais FDS/feriado | `getHospitaisEfetivo(now, feriadosSet)` (`hospitaisTecnicas2026.js`) | 00h–17:59 → hoje; ≥18h → amanhã; com `feriadosSet`, dia não-útil avança ao próximo dia útil |
| Estágios residência (slot manhã/tarde) | `getSlotEfetivo(now, feriadosSet)` (`residencia2026.js`) | 00–10:59 manhã hoje · 11–17:59 tarde hoje · ≥18h manhã de amanhã; FDS/feriado pula para próximo dia útil |
| Cards de escala (Estágios/Técnicas/Secretárias) | `getEscalaCardDate(now, feriadosSet)` | ≥18h → dia seguinte; pula dias não-úteis |

- Hooks recomputam por `setInterval` (ex.: `useSobreavisoMaterno` a cada 60s, só troca state se o `dateKey` mudou).
- **Estágios da residência**: quinzenas fixas em `ROTACOES_2026` (`residencia2026.js`) — 24 períodos de ~15 dias (01–15 / 16–fim do mês), de 01/mar/2026 a 28/fev/2027. `getQuinzenaParaData(date)` encontra o período; `getEstagiosParaData(date)` devolve os 8 residentes com estágio formatado (`formatEstagio`: "CX GERAL" → "Cx Geral"; siglas APA/GO preservadas).
- Feriados: `FERIADOS_2026` (Set) + `FERIADO_LABELS` em `plantao2026.js`; `isDiaNaoUtil()` / `getProximoDiaUtil()` em `residencia2026.js`.
- Horários: plantão residência é 12h (19h→07h) em dia útil e 24h (07h→07h) em FDS/feriado (`isPlantao24h` / `getHorarioPlantao`).

## Integração com Notificações

Builders **puros** (sem Firebase/React, testáveis) geram payload por evento do ciclo de vida (`created` | `accepted` | `rejected` | `cancelled`):

| Módulo | Builder | Categoria | actionUrl |
|--------|---------|-----------|-----------|
| Residência | `src/utils/tradeNotifications.js` | `plantao` | `trocasPlantao` |
| Sobreaviso | `src/utils/sobreavisoNotifications.js` | `sobreaviso` | `trocasSobreaviso` |
| Hospitalar | `src/utils/plantaoHospitalarNotifications.js` | `plantao-hospitalar` | `trocasPlantaoHospitalar` |

Todos com `priority: 'alta'` e `actionLabel: 'Ver Troca'`.

**Destinatários por evento** (`get*NotificationRecipients`):
- `created`: direcionada → só destinatária; aberta → todos os demais ids da escala (menos o ator).
- `accepted` / `rejected`: só a solicitante.
- `cancelled`: só destinatária (apenas se a troca era direcionada).

**Disparo**: nas páginas (`TrocasPlantaoPage`, `TrocasSobreavisoPage`, `TrocasPlantaoHospitalarPage`), após sucesso da mutation — resolve ids da escala → Firebase UIDs (caches acima) e chama `createSystemNotification({...recipientIds})` do `MessagesContext`. Falha de notificação é silenciosa (`console.warn`), não bloqueia a troca.

**Lembretes de plantão (D-1 / D-0)** — hooks que criam notificações de inbox aplicando overrides de trocas aceitas:
- `src/hooks/useShiftReminders.js` — anestesistas (Pega Plantão), admin-only, D-1 + 1h antes; férias D-1.
- `src/hooks/useResidenteShiftReminders.js` — **admin-only** (`enabled: isAdmin` na Home + guard `user?.isAdmin` no hook): a sessão de um admin cria os lembretes para os residentes escalados (match por email → profiles). Base `PLANTOES_2026` + override `residenciaPlantaoDiario`.
- `src/hooks/useFuncionariaShiftReminders.js` — funcionária logada, sobreaviso + plantão hospitalar (overrides `sobreavisoMaternoDiario` + `hospitaisDiario`).
- Idempotência: dedup por sessão (Set module-level) + `notifications.related_entity_id` determinístico no Supabase (ex.: `plantao-residencia_{dateKey}_{residenteId}_{tipo}`).
