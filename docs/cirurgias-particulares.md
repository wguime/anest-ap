# Cirurgias Particulares — cobrança de honorários

> Card na aba **Menu** → módulo CRUD Supabase + relatório por período (tela + PDF).
> Em produção desde 2026-07-22. Decisões do dono: grupo todo vê tudo; nome
> completo do paciente; valor + status de pagamento; relatório tela + PDF.

## O que faz
Anestesiologistas do grupo registram cirurgias particulares (fora de convênio)
para controlar a cobrança dos honorários e conferir/auditar pagamentos por
período: paciente (nome completo), cirurgião, anestesista, data, procedimento,
local, **valor (R$)** e **status de pagamento** (pendente/pago/glosado, com
`data_pagamento` auto ao marcar pago). Lançamento errado nunca é apagado —
**soft-cancel** (`cancelada_em/por/motivo`), sem policy DELETE.

## Arquitetura
| Camada | Arquivo |
|---|---|
| Migration | `supabase/migrations/20260722100000_cirurgias_particulares.sql` (aplicada 2026-07-22) |
| Service | `src/services/supabaseCirurgiasParticularesService.js` (CAMEL_TO_SNAKE completo; `toLocalISODate` p/ DATE) |
| Context | `src/contexts/CirurgiasParticularesContext.jsx` (useReducer + realtime + `requireUserId`; provider ON-DEMAND nos 2 cases do App.jsx — dados financeiros não carregam p/ quem não usa) |
| Lib pura | `src/lib/cirurgiasParticulares.js` + testes `src/__tests__/lib/cirurgiasParticulares.test.js` (21) |
| Páginas | `src/pages/cirurgias-particulares/` — listagem (= relatório em tela) + form criar/editar |
| PDF | `src/services/pdf/templates/cirurgiasParticularesReportTemplate.js` (registry `cirurgiasParticularesReport`) |
| Card/nav | `MenuPage` (`canAccessCard('cirurgias_particulares')`) · `NAV_STRUCTURE.menu.cards` · `PAGE_TO_CARD` (2 páginas → mesmo card) |

**RLS**: `can_write_cirurgias_particulares()` = role `anestesiologista`/`secretaria` OU admin —
mesmo predicado p/ SELECT/INSERT/UPDATE (grupo todo vê tudo). Residente fora
(não fatura particular; incluir depois = 1 linha no helper). `FORCE ROW LEVEL
SECURITY` + `REVOKE DELETE` (defesa em profundidade). Realtime na publication.

## Integração com a Escala Cirúrgica
- **Import**: no form (só criar), "Importar da escala do dia" → Modal com data +
  hospital → `fetchEscala` → filtra `familiaConvenio(convenio) === 'particular'`
  (helper de `src/pages/escala-cirurgica/utils.js`). Pré-preenche data/local/
  cirurgião/procedimento/anestesista (resolve `anestesistaUserId` → nome) e
  paciente = **iniciais a completar** — save bloqueado enquanto
  `pareceIniciais(paciente)` (espelho do CHECK da escala).
- **Vínculo fraco**: `escala_caso_id UUID` SEM FK (republicação da escala faz
  DELETE+reinsert dos casos — ids instáveis; o lançamento carrega snapshot
  completo). Índice único parcial impede 2 lançamentos ATIVOS do mesmo caso
  (cancelado libera re-lançar; erro 23505 vira toast "já tem lançamento ativo").
- **Suspensa (2 momentos)**: no import, caso com `statusExtra='suspensa'`
  aparece desabilitado (badge vermelho) — suspensa não gera cobrança; se o
  plantonista reverter o toggle, volta a ser importável sozinho. DEPOIS do
  lançamento, a listagem faz batch-check (`fetchCasosStatus(ids)` no service da
  escala) e mostra alerta âmbar "Suspensa na escala — conferir" com ação de
  cancelar o lançamento. Caso não encontrado (escala republicada) = sem alerta.

## LGPD
Nome do paciente + procedimento = **dado de saúde sensível (art. 5º II)**.
Base legal primária: **art. 11, II, "d"** (exercício regular de direitos em
contrato — conferir cobrança contra guia/recibo exige o nome); suporte art. 7º
V/VI. Documentada no header da migration. Nunca logar dados do paciente em
console/notificação (só `error.message`). PDF leva tarja "CONFIDENCIAL — USO
INTERNO" + "Gerado por {nome} em {data/hora}" (accountability — o arquivo sai
do perímetro RLS ao ser compartilhado).

### Pendências registradas na revisão LGPD (2026-07-22, não-bloqueantes)
1. **Retenção (F2)**: prazo não definido — registro financeiro pede guarda
   ~5 anos (prescrição de cobrança, CC art. 206 §5º I). Follow-up: seed em
   `retention_policies` + `retention_until` + job que anonimiza só `paciente`
   após o prazo (padrão dos incidentes, art. 16 I).
2. **RIPD (F4)**: adicionar o módulo ao registro de operações (precedente
   `docs/lgpd-ripd-incidentes.md`), cobrindo: base legal, retenção pendente,
   fluxo manual de direitos do paciente terceiro (eliminação = anonimização
   pós-prazo) e a decisão consciente do dono de que **o grupo todo (incl.
   secretaria) vê o faturamento individual por colega** (F7).
3. Helpers `can_write_*` (cateter/escala/este) não exigem `p.active = true` —
   se endurecer, endurecer os três juntos (hardening separado).

## Verificado em 2026-07-22
- 21/21 testes da lib; lint 0 erros; build + dev server OK.
- migration-validator aprovou (idempotente, RLS completa, rollback aditivo).
- Smoke Playwright mobile 375px (user e2e anestesiologista, prod DB): card no
  Menu → listagem → form → import modal → criar (INSERT via RLS) → totais →
  marcar pago → cancelar lançamento (some da lista). Zero erros de console.
- PDF real gerado pelo botão: tarja, stat boxes, tabela paginável com linha
  TOTAL, resumo por anestesista, somas conferidas. Registros de teste apagados.
