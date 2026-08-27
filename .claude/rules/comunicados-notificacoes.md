---
paths:
  - "src/pages/ComunicadosPage.jsx"
  - "src/contexts/ComunicadosContext.jsx"
  - "src/services/supabaseComunicadosService.js"
  - "src/utils/comunicadosHelpers.js"
  - "src/design-system/components/anest/comunicados-card.jsx"
  - "src/pages/management/comunicados/**"
  - "src/pages/incidents/**"
  - "src/pages/IncidentesPage.jsx"
description: Comunicados (iOS Mail) e Notificações/Denúncias — 4 camadas, sino unificado, nome das superfícies de entrada
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

## Notificações e Denúncias (ex-"Gestão de Incidentes")
**Renomeado 2026-08-19 (dono): "a equipe não achava"** — quem quer notificar um evento adverso não procura por "Gestão de Incidentes". Trocado nas 6 superfícies de ENTRADA: card da GestaoPage, `PageHeader` da IncidentesPage, `AppCommandPalette` (rótulo + 11 termos: denúncia/denunciar/near miss/relato/assédio/…), `atalhosConfig`, `rolePermissionTemplates` e `useActivityTracking`. **Rota, IDs e chave de permissão continuam `incidentes`** — mudar quebra link salvo e permissão concedida sem ganho para quem usa. **ROP 1.2 do Qmentum, RIPD e política de privacidade mantêm o nome oficial** ("Gestão de Incidentes sobre a Segurança dos Pacientes"): são artefatos de conformidade, não navegação.

**Destaque visual — `ComunicadosCard variant="solid"`** (dono 19/08, escolhido em protótipo antes do código): o nome era só metade do problema; a outra era o cartão ser o 1º de TRÊS visualmente idênticos na aba. Solid = `bg-gradient-to-br from-greenMedium to-greenBright` + texto branco + badge branco, **a MESMA tinta nos dois temas de propósito**. ⚠️ a tentação de escurecer o gradiente no dark (`greenDark→greenDarkest`, que é o que o banner da IncidentesPage faz) foi testada e REPROVADA: em L do HSL o cartão ficaria 12,9%→6,7% contra vizinhos de 12,2% e fundo de 8,2% — começa na clareza dos vizinhos e termina mais escuro que a página, então não tem contraste de massa em ponto nenhum e some. A tinta escolhida fica em L 20→36%. É o ÚNICO cartão pintado da aba; pintar um segundo devolve o problema.

## Comunicados
Design iOS Mail em widget e página. Arquitetura: 4 camadas.

**Fluxo:** `HomePage (widget)` → `ComunicadosPage (full)` → `ComunicadosContext (split State/Actions)` → `supabaseComunicadosService` → 3 tabelas Supabase (`comunicados`, `comunicado_confirmacoes`, `comunicado_acoes_completadas`).

**Card (2026-07-22: saiu da Home → aba Gestão):** `ComunicadosCard` modo legado logo abaixo do card Biblioteca em GestaoPage — títulos recentes como bullets + badge "N não lidos"/"Ver todos". O modo feed iOS-Mail do componente (prop `comunicados`) segue no DS sem uso ativo; o modo legado (prop `items` string[]) é usado por EducacaoPage, GestaoPage, GestaoDocumentalPage. No lugar do widget na Home entrou o `EscalaCirurgicaHomeCard` (ver Escala Cirúrgica Diária).

**Página (iOS Mail list):** container único `rounded-2xl bg-card` com items separados por dividers (`mx-4 border-t`). Cada item: dot não-lido absolute, autor bold + badge tipo + timestamp, título bold, preview + clip icon. Sem cards individuais.

**Formulário criar/editar:** fullscreen com 4 seções agrupadas em cards (Essencial, Público-alvo, Datas, Compliance, Extras). Labels `uppercase tracking-wide text-primary` com ícones. Footer fixo com 3 botões (Cancelar, Rascunho, Publicar).

**Sino unificado:** `pendenciasCount = mensagens + notificações + comunicados não-lidos`. Ponte: publicar comunicado cria notificação na inbox via `notifyComunicadoPublicado`.

**Tipos com badges:** Urgente (destructive), Importante (warning), Informativo (info), Evento (secondary), Geral (default).

**Refs:**
- Widget DS: `src/design-system/components/anest/comunicados-card.jsx`
- Página: `src/pages/ComunicadosPage.jsx`
- Context: `src/contexts/ComunicadosContext.jsx`
- Service: `src/services/supabaseComunicadosService.js`
- Helpers: `src/utils/comunicadosHelpers.js`
- Monitor admin: `src/pages/management/comunicados/ComunicadosMonitorTab.jsx`

**Bugs da auditoria 2026-05-27 — RESOLVIDOS no hardening 2026-06-10:**
- RLS UPDATE+SELECT para autor (migration `20260626600000`, aplicada): autor edita/vê o próprio comunicado (inclusive rascunho/arquivado)
- Silent failure de notificação: fallback `fetchAllUsers` + warn + toast se `contextUsers` vazio
- Z-index: modal criar/editar e `ConfirmDialog` DS → `z-submodal` (1200)
- Dead code pin/unpin removido do service (colunas `is_pinned/*` existem via migration `20260626200000`, sem UI — futuro)
- `window.confirm()` já havia sido trocado por `ConfirmDialog` antes da auditoria
