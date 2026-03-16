# ANEST Design System - Guia Completo para Claude Code

> **Versão:** 3.45.0
> **Última atualização:** 09/03/2026
> **Autor:** Guilherme (Product Owner)
> **Baseado em:** v3.44.0 + Fix Anexos Comunicados (Upload Firebase Storage + Timestamp Sanitization)

---

## 🔴 REGRAS CRÍTICAS - LEIA PRIMEIRO!

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    REGRA #1: PESQUISA OBRIGATÓRIA NOS MCPs                   ║
║                                                                              ║
║  SEMPRE pesquisar nos MCPs ANTES de implementar qualquer código!             ║
║                                                                              ║
║  1. context7   → documentação técnica (React, Firebase, Tailwind, etc)       ║
║  2. shadcn     → padrões de componentes UI                                   ║
║  3. firecrawl  → best practices e soluções online                            ║
║  4. figma      → especificações de design (se houver mockup)                 ║
║                                                                              ║
║  Isso evita: código desatualizado, padrões incorretos, retrabalho            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Prompt Inicial para Sessões Claude Code

```
Leia o arquivo CLAUDE_CONTEXT.md para entender o projeto ANEST.

Minha tarefa: [DESCREVA A TAREFA AQUI]

ANTES de implementar qualquer código:
1. Use context7 MCP para buscar documentação atualizada da tecnologia
2. Use shadcn MCP para verificar padrões de componentes
3. Use firecrawl MCP para pesquisar soluções e best practices online

Ao final da sessão, informe se CLAUDE_CONTEXT.md precisa ser atualizado.
```

---

## ÍNDICE

0. [📋 Changelog - Histórico de Atualizações](#-changelog---histórico-de-atualizações)
1. [Visão Geral do Projeto](#1-visão-geral-do-projeto)
2. [Arquitetura e Estrutura](#2-arquitetura-e-estrutura)
3. [Design System - Especificações](#3-design-system---especificações)
4. [Componentes UI](#4-componentes-ui)
5. [Componentes ANEST](#5-componentes-anest)
6. [Hooks](#6-hooks)
7. [Showcases](#7-showcases)
8. [Responsividade](#8-responsividade)
9. [Padrões de Código](#9-padrões-de-código)
10. [Calculadoras Médicas](#10-calculadoras-médicas)
11. [Troubleshooting](#11-troubleshooting)
12. [Checklist de Validação](#12-checklist-de-validação)
13. [Páginas do App](#13-páginas-do-app)
14. [Sistema de Gestão Documental](#14-sistema-de-gestão-documental)
15. [Sistema de Permissões](#15-sistema-de-permissões)
16. [Componentes de Página](#16-componentes-de-página)
17. [Mock Data](#17-mock-data)
18. [MCPs - Model Context Protocol](#18-mcps---model-context-protocol)
19. [Fases do Projeto](#19-fases-do-projeto)
20. [Padrões de Navegação React](#20-padrões-de-navegação-react)
21. [Sistema de Documentos Arquivados](#21-sistema-de-documentos-arquivados)
22. [Integração API Pega Plantão](#22-integração-api-pega-plantão)
23. [Sistema de Organograma](#23-sistema-de-organograma)
24. [Formulários Públicos e QR Codes](#24-formulários-públicos-e-qr-codes)
25. [DocumentsContext - Single Source of Truth](#25-documentscontext---single-source-of-truth)
26. [Módulo de Educação (Admin)](#26-módulo-de-educação-admin)
27. [Sistema de Comunicação (Mensagens & Notificações)](#27-sistema-de-comunicação-mensagens--notificações)
28. [Centro de Gestão Qmentum - Conformidade Completa](#28-centro-de-gestão-qmentum---conformidade-completa) ← NOVO
29. [Plano de Banco de Dados - Supabase](#29-plano-de-banco-de-dados---supabase)
30. [Conformidade LGPD - Gestão de Incidentes](#30-conformidade-lgpd---gestão-de-incidentes)
31. [Monitoramento de Comunicados Qmentum](#31-monitoramento-de-comunicados-qmentum)
32. [Lacunas Estruturais — Implementação Completa](#32-lacunas-estruturais--implementação-completa) ← NOVO

---

## 📋 CHANGELOG - HISTÓRICO DE ATUALIZAÇÕES

### v3.45.0 (09/03/2026) - Fix Anexos Comunicados: Upload Firebase Storage + Timestamp Sanitization

**Escopo:** Correção do bug em que imagens anexadas a comunicados não ficavam visíveis após recarregar a página. A causa raiz era que `URL.createObjectURL(file)` gerava uma URL `blob:` temporária (válida apenas na sessão do navegador) que era salva diretamente no Supabase. Ao recarregar ou acessar de outro dispositivo, a URL expirava e a imagem quebrava. Também corrigido erro de timestamp inválido ao editar comunicados com campos de data vazios.

**Arquivos modificados:**

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/pages/ComunicadosPage.jsx` | Import de `uploadFile` do `uploadService.js`. Em `salvarComunicado()`, substituído `URL.createObjectURL(file)` por upload real para Firebase Storage via `uploadFile(file, 'Comunicados')`. Cada arquivo é enviado em paralelo com `Promise.all`, com tratamento de erro individual (se um falhar, os demais ainda são salvos). Campo `path` do Storage salvo no anexo para futura exclusão. `arquivosSelecionados` limpo após salvar com sucesso. |
| 2 | `src/services/supabaseComunicadosService.js` | Na função `update()`, adicionada sanitização de campos timestamp (`prazo_confirmacao`, `data_validade`, `data_evento`): strings vazias `""` são convertidas para `null` antes de enviar ao Supabase, evitando erro `invalid input syntax for type timestamp with time zone`. |

**Fluxo corrigido (upload de anexos):**
1. Usuário seleciona arquivo no formulário de comunicado
2. `salvarComunicado()` faz upload para Firebase Storage (`Comunicados/` folder) via `uploadFile()`
3. URL permanente de download (`https://firebasestorage.googleapis.com/...`) é retornada
4. Anexo salvo no Supabase com `{ nome, url (permanente), path, tamanho, tipo }`
5. `ZoomableImage` carrega a imagem com URL permanente — funciona em qualquer sessão/dispositivo

**Fluxo corrigido (edição com datas vazias):**
1. Ao editar comunicado, campos de data opcionais (`prazoConfirmacao`, `dataValidade`, `dataEvento`) podem estar vazios (`""`)
2. `update()` agora converte `""` → `null` antes de enviar ao PostgreSQL
3. Evita erro `invalid input syntax for type timestamp with time zone: ""`

**Dados corrigidos no Supabase:**
- Comunicado `com-4c2da4c9` ("Evolução Médica Estruturada"): anexo com URL `blob:` removido (imagem original perdida, precisa ser re-anexada)

---

### v3.44.0 (25/02/2026) - Fix Admin Firestore Sync (Centro de Gestão visível para administradores)

**Escopo:** Correção do bug em que usuários promovidos a "Administrador" via Centro de Gestão > Editar Permissões não viam a opção "Centro de Gestão" no seu perfil. A causa raiz era que as permissões (isAdmin, role, isCoordenador) eram salvas apenas no **Supabase** (profiles table) pelo UsersManagementContext, mas o UserContext (que alimenta o ProfilePage e isAdministrator()) lê do **Firestore** (userProfiles collection). O Firestore nunca recebia as flags de admin.

**Arquivos modificados:**

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/pages/management/CentroGestaoPage.jsx` | Import de `doc`, `updateDoc` do Firebase Firestore e `db` do config. Em `handleSaveUserPermissions`, após salvar no Supabase via `contextUpdateUser`, agora sincroniza `role`, `isAdmin` e `isCoordenador` no Firestore `userProfiles/{userId}`. Sync envolto em try/catch separado (non-critical) para não bloquear o fluxo principal. |

**Fluxo corrigido:**
1. Admin ativa toggle "Administrador" no PermissionsModal → `isAdmin: true`
2. `handleSaveUserPermissions` salva no Supabase (via `contextUpdateUser`) **E** no Firestore (via `updateDoc`)
3. Quando o usuário faz login/refresh, `UserContext` lê o perfil do Firestore com `isAdmin: true`
4. `isAdministrator(user)` retorna `true` → "Centro de Gestão" aparece no perfil

**Nota:** O usuário que recebeu permissão de administrador precisa relogar ou dar refresh para que o UserContext recarregue o perfil atualizado do Firestore.

---

### v3.43.0 (21/02/2026) - 27 Gaps Centro de Gestão 100% Conformidade + ErrorBoundary + Fix Blank Page

**Escopo:** Implementação completa de 27 gaps distribuídos em 9 áreas para atingir 100% de conformidade no Centro de Gestão. Adição de ErrorBoundary global. Fix de blank page em produção causada por null safety no AssignStaffModal. Migração SQL `infra_health_history` executada em produção.

**Arquivos novos:**
- `src/services/firestoreSubscriptionHelper.js` — Helper reutilizável para subscriptions Firestore com retry exponencial, reconexão automática e status de conexão
- `src/pages/management/users/AuditLogTab.jsx` — Visualização de audit log de permissões (tabela com filtros por usuário, ação, período)
- `src/sql/infra_health_history.sql` — Migration SQL para tabela de histórico de health checks

**Arquivos modificados (27 gaps):**

| # | Arquivo | Alteração |
|---|---------|-----------|
| 1 | `src/contexts/UsersManagementContext.jsx` | Handler UPDATE em real-time de `authorized_emails`, optimistic UI para add/remove email, connection status via `createReliableSubscription`, subscription real-time para `lgpd_solicitacoes` com notificação admin |
| 2 | `src/pages/management/emails/EmailsTab.jsx` | Badge de status de conexão real-time (Conectado/Reconectando/Desconectado) |
| 3 | `src/services/supabaseUsersService.js` | `changedBy` recebe `currentUserId` real em vez de `'admin'`, audit de `custom_permissions`, novo `fetchAuditLog(filters)` |
| 4 | `src/pages/management/users/UsersTab.jsx` | Integração com AuditLogTab |
| 5 | `src/hooks/useResidencia.js` | Error handling com toast, reconexão via `createFirestoreSubscription`, state `connectionStatus` |
| 6 | `src/services/residenciaService.js` | Usa `createFirestoreSubscription` do helper |
| 7 | `src/hooks/useStaff.js` | Error handling com toast, reconexão via `createFirestoreSubscription`, state `connectionStatus` |
| 8 | `src/services/staffService.js` | Usa `createFirestoreSubscription` do helper |
| 9 | `src/hooks/useInfraStatus.js` | `saveHealthCheck()` insere resumo em `infra_health_history`, `cleanupOldHealthChecks()` deleta >90 dias |
| 10 | `src/pages/management/infra/InfraStatusTab.jsx` | Seção "Ambiente" visível apenas para admin (esconde project IDs para não-admin) |
| 11 | `src/pages/management/comunicados/ComunicadosMonitorTab.jsx` | UI para selecionar `ropRelacionada` ao criar/editar, filtro por ROP, badges de ROPs em cards, relatório de compliance por ROP |
| 12 | `src/contexts/ComunicadosContext.jsx` | Suporte ao campo `ropRelacionada` |
| 13 | `src/services/supabaseComunicadosService.js` | Persistência do campo `ropRelacionada text[]` |
| 14 | `src/hooks/useComplianceMetrics.js` | Métricas LGPD: solicitações pendentes/resolvidas, tempo médio resposta, mapeamento para ROPs |
| 15 | `src/pages/management/documents/ComplianceDashboard.jsx` | Seção LGPD: total pendentes, taxa resolução, tempo médio, status geral |
| 16 | `src/services/lgpdService.js` | Structured error handling com array `errors` parciais, input validation (`userId`, email regex), per-source error tracking em `exportUserData` |
| 17 | `src/pages/ProfilePage.jsx` | Exibe status de solicitação LGPD (pendente/processada com data) |

**Fix Blank Page (produção):**
| # | Arquivo | Alteração |
|---|---------|-----------|
| 18 | `src/main.jsx` | **ErrorBoundary** class component global: captura erros runtime e exibe tela de diagnóstico (em vez de página branca). Wrapper de toda a árvore React |
| 19 | `src/design-system/components/anest/assign-staff-modal.jsx` | **ROOT CAUSE**: `staff.hospitais` → `staff?.hospitais`, `staff.consultorio` → `staff?.consultorio` (null safety no useMemo de nameOptions) |
| 20 | `src/pages/HomePage.jsx` | AssignStaffModal de always-mounted para conditional rendering: `{showAssignStaffModal !== null && staff && (<AssignStaffModal open .../>)}` |

**Tabela Supabase nova:**
- `infra_health_history` — 8 colunas (id uuid PK, checked_at, firebase_status, supabase_status, supabase_latency_ms, modules_live, modules_total, checked_by). RLS: SELECT/INSERT autenticado, DELETE apenas >90 dias.

**9 áreas de conformidade implementadas:**
1. Emails Sync (3 gaps): UPDATE events, optimistic UI, connection status
2. Usuários LGPD/Auditoria (4 gaps): changedBy real, audit custom_permissions, fetchAuditLog + UI, admin login tracking
3. Residência Sync (3 gaps): error handling toast, retry com backoff, connection status
4. Funcionários Sync (3 gaps): error handling toast, retry com backoff, connection status
5. Infraestrutura LGPD (3 gaps): health check history, retenção 90 dias, visibilidade por role
6. Comunicados Qmentum (3 gaps): ropRelacionada UI, filtro por ROP, relatório compliance
7. LGPD Qmentum (2 gaps): métricas LGPD no hook, seção LGPD no ComplianceDashboard
8. LGPD Melhores Práticas (3 gaps): structured error handling, input validation, per-source tracking
9. LGPD Sync (3 gaps): real-time lgpd_solicitacoes, status no ProfilePage, probe no InfraStatus

---

### v3.42.0 (21/02/2026) - Fix Gestão de Incidentes: Persistência + Dropdown Dinâmico

**Escopo:** Correção da persistência de dados na Gestão de Incidentes/Denúncias (Painel de Ética). Formulário de gestão interna agora carrega dados previamente salvos ao reabrir a página. Dropdown de responsáveis usa lista dinâmica do `UsersManagementContext` em vez de lista hardcoded. Dispatch local no contexto após salvar no Supabase.

**Arquivos modificados:**
- `src/pages/incidents/IncidenteGestaoPage.jsx` (carregar `gestaoInterna`, dropdown dinâmico, referências `admin` → `gestaoInterna`)
- `src/pages/incidents/DenunciaGestaoPage.jsx` (carregar `gestaoInterna`, dropdown dinâmico, referências `admin` → `gestaoInterna`)
- `src/contexts/IncidentsContext.jsx` (dispatch local após save no Supabase)

**Alterações implementadas:**

1. **Estado inicial lê de `gestaoInterna` (Bug Fix)**
   - `IncidenteGestaoPage`: `useState` inicializava com valores vazios/de `incidente.admin`. Agora lê de `incidente.gestaoInterna` — a coluna onde `updateGestaoInterna()` efetivamente salva
   - `DenunciaGestaoPage`: mesmo fix, lê de `denuncia.gestaoInterna`
   - Campos carregados: `responsavelAnalise`, `prioridadeInterna`, `classificacaoInterna`, `dataLimiteResposta`, `notasInternas`, `parecer`, `recomendacoes`, `feedbackAoRelator`, `rca`, `ropsVinculados`, `acoes`

2. **Referências de `admin` → `gestaoInterna` (Consistência)**
   - `deadlineInfo` (useMemo): `incidente.admin.historicoStatus` → `incidente.gestaoInterna.historicoStatus` (com fallback para `admin`)
   - Timeline (Histórico de Status): mesmo ajuste para leitura de `historicoStatus`
   - Aplicado em ambas as páginas (Incidente e Denúncia)

3. **Dropdown dinâmico de responsáveis**
   - Import de `useUsersManagement` do `UsersManagementContext`
   - `responsaveisOptions` (useMemo): se `incidentResponsibles.length > 0`, mapeia para `{ value: r.id, label: r.nome }`. Senão, fallback para `MEMBROS_COMITE` (lista hardcoded mock)
   - Select de "Responsável pela Análise" usa `options={responsaveisOptions}` em vez de `options={MEMBROS_COMITE}`

4. **Dispatch local após save no Supabase (IncidentsContext)**
   - `updateGestaoInterna()`: antes chamava `supabaseIncidentsService.updateGestaoInterna()` sem dispatch local
   - Agora captura o `result` retornado pelo Supabase e faz `dispatch({ type: result.tipo === 'denuncia' ? 'UPDATE_DENUNCIA' : 'UPDATE_INCIDENTE', payload: result })`
   - Garante que o estado React local reflete os dados salvos sem necessitar reload

---

### v3.41.0 (18/02/2026) - Reuniões: PDF Viewer + FileUpload Fixes + Participant Notifications

**Escopo:** Correção do PDF viewer no módulo de Reuniões (CORS + componente), correção de overflow do FileUpload em modais, ordenação por data+horário, migração de cores para DS tokens no ReuniaoCard, e novo sistema de notificações in-app para participantes de reuniões (convocação + lembretes automáticos).

**Arquivos modificados:**
- `src/design-system/components/ui/file-upload.jsx` (4 fixes CSS overflow em modais)
- `src/design-system/components/ui/pdf-viewer.jsx` (prop `showTitle`, removido "Abrir em nova aba")
- `src/design-system/components/ui/modal.jsx` (`break-all` em Modal.Title)
- `src/pages/reunioes/ReuniaoDetalhePage.jsx` (overlay manual → ViewPdfModal)
- `src/components/etica/ViewPdfModal.jsx` (`showTitle={false}` para evitar título duplicado)
- `src/pages/ReunioesPage.jsx` (função `sortByDateTime` para ordenação data+horário)
- `src/components/reunioes/ReuniaoCard.jsx` (DS tokens: `bg-accent`, `text-primary`, variant `default`)
- `src/components/reunioes/NovaReuniaoModal.jsx` (checkbox list de participantes, notificações)
- `src/services/reunioesService.js` (3 funções de notificação)
- `firestore.rules` (collection `reuniao_notifications`)

**Alterações implementadas:**

1. **PDF Viewer — Fix CORS + Componente**
   - Firebase Storage CORS configurado para `anest-ap.firebasestorage.app` (origin `*`, methods GET/HEAD)
   - Overlay manual com `createPortal` em `ReuniaoDetalhePage` substituído por `<ViewPdfModal>` (já testado em Ética)
   - `ViewPdfModal` usa `PDFViewer` com `showTitle={false}` (título no Modal header, não duplicado no toolbar)
   - PDFViewer: nova prop `showTitle` (default `true`), condição `{!isFullscreen && showTitle && (`
   - Removido botão "Abrir em nova aba" do estado de erro do PDFViewer

2. **FileUpload — Fix Overflow em Modais (DS-level)**
   - `FilePreview` motion.div: adicionado `w-full min-w-0` (card não expande além do container)
   - Dropzone file list: `<div className="grid gap-2 mt-2 min-w-0">`
   - Button variant file list: `<div className="grid gap-2 mt-1 min-w-0">`
   - Button variant filename span: `truncate flex-1 min-w-0` (nome longo trunca com ellipsis)

3. **Modal.Title — Quebra de palavras longas**
   ```jsx
   className={cn("text-[20px] font-bold leading-6 break-all", className)}
   ```
   - Permite nomes de arquivo com underscores (ex: `Protocolo_Seguranca_Medicamentos_2026.pdf`) quebrarem em múltiplas linhas

4. **Reuniões — Ordenação por Data + Horário**
   - Nova função `sortByDateTime(reunioes, order)` em `ReunioesPage.jsx`
   - Combina `dataReuniao` (Date) com `horario` (string `HH:MM`) para sort preciso
   - Aplicada: agendadas (asc), passadas (desc)

5. **ReuniaoCard — DS Color Tokens**
   - Status `agendada`: `variant: 'info'` (azul) → `variant: 'default'` (verde DS)
   - Ícone: hardcoded `style={{ backgroundColor, color }}` → `className="bg-accent"` + `className="text-primary"`
   - Tipo badge: inline style → `className="bg-accent text-primary"`

6. **Notificações de Participantes (NOVO)**

   **Fluxo completo:**
   - Ao selecionar "Perfis Convocados" no Step 2 da NovaReuniaoModal, o campo "Participantes (nomes)" exibe checkbox list com todos os usuários ativos que possuem o role correspondente
   - Usuários são auto-selecionados ao adicionar perfil, preservando deselections manuais ao adicionar/remover perfis (via `useRef` para tracking de IDs anteriores)
   - "Selecionar todos" / "Desmarcar todos" toggle disponível
   - Se nenhum perfil selecionado, fallback para textarea manual (sem notificações)
   - No submit, apenas usuários com checkbox marcado recebem notificações

   **UI do checkbox list:**
   ```jsx
   // Cada item: checkbox (CheckSquare/Square) + nome + badge de perfil com cor
   // Container com max-h-[200px] overflow-y-auto, divide-y
   // Contador "X de Y selecionados"
   ```

   **Service layer (`reunioesService.js` — 3 novas funções):**
   - `notifyReuniaoParticipantes(reuniaoId, reuniaoData, participants, createdBy)` — cria até 3 docs por participante no Firestore:
     - `type: 'convocacao'` — imediata
     - `type: 'lembrete_1d'` — 1 dia antes (se > 24h no futuro)
     - `type: 'lembrete_1h'` — 1 hora antes (se > 1h no futuro)
   - `getUserNotifications(userId)` — busca notificações onde `scheduledFor <= now` e `readAt == null`
   - `markNotificationRead(notificationId)` — marca `readAt: serverTimestamp()`

   **Firestore collection `reuniao_notifications`:**
   ```javascript
   {
     userId: string,          // Firebase UID do destinatário
     reuniaoId: string,       // ID da reunião
     type: 'convocacao' | 'lembrete_1d' | 'lembrete_1h',
     subject: string,
     content: string,
     titulo: string,          // título da reunião
     local: string,
     horario: string,
     createdByName: string,
     createdAt: Timestamp,
     scheduledFor: Timestamp, // quando deve ser exibida
     readAt: Timestamp | null,
   }
   ```

   **Firestore Rules (`reuniao_notifications`):**
   - `allow read`: autenticado + `resource.data.userId == request.auth.uid`
   - `allow create`: `isAdmin()` (apenas admin/coordenador cria reuniões)
   - `allow update`: autenticado + owner + apenas campo `readAt` modificável

   **Review step (Step 3):**
   - Participantes selecionados exibidos como pill badges (`bg-accent text-primary`)
   - Contador: "Participantes (N convocados)"
   - Nota: "Estes participantes receberão notificações da reunião e lembretes."

   **Dados persistidos na reunião:**
   - `participantesIds: string[]` — array de user IDs selecionados (salvo em `reunioes/{id}`)

   **Funcionalidade opcional:** se nenhum perfil selecionado ou todos desmarcados, nenhuma notificação é enviada. A funcionalidade é completamente opt-in.

---

### v3.40.0 (18/02/2026) - Login Page UX Refresh + Biometric Auth + Keep Me Logged In

**Escopo:** Redesign visual da tela de login (fundo, círculos, tipografia), autenticação biométrica completa via WebAuthn (Face ID / Touch ID), funcionalidade "Manter conectado" com Firebase persistence, e correção de navegação pós-login.

**Arquivos criados:**
- `src/services/biometricService.js` (NOVO — serviço completo de autenticação biométrica)

**Arquivos modificados:**
- `src/design-system/components/ui/animated-background.jsx` (cores e opacidades)
- `src/pages/LoginPage.jsx` (UX completa, biometria, manter conectado)
- `src/App.jsx` (reset navegação pós-login)

**Alterações implementadas:**

1. **AnimatedBackground — Fundo mais claro**
   - Gradiente: `from-[#004225] to-[#006837]` → `from-[#006837] to-[#00894B]` (verde mais claro para destacar o logo)
   - Borda círculos concêntricos: `border-[#2ECC71]/20` → `border-[#2ECC71]/40` (mais visíveis)
   - Opacidade animação círculos: `[0.1, 0.15, 0.1]` → `[0.2, 0.35, 0.2]` (mais presentes)
   - Dots flutuantes: opacidade `[0.3, 0.6, 0.3]` → `[0.4, 0.7, 0.4]`, bg `/30` → `/40`

2. **LoginPage — Tipografia aumentada (harmonia mantida)**
   - Bem-Vindo à ANEST: `text-[11px] sm:text-xs` → `text-sm sm:text-base`
   - Tabs Login/Cadastro: `text-xs sm:text-sm` → `text-sm sm:text-base`
   - Labels E-mail/Senha: `text-[11px] sm:text-xs` → `text-xs sm:text-sm`
   - Inputs: `text-sm` → `text-sm sm:text-base`
   - Botão Entrar: `text-sm` → `text-base sm:text-lg`
   - Biometria: `text-base sm:text-lg` com ícones `ScanFace` + `Fingerprint`
   - Esqueceu a senha: `text-[11px] sm:text-xs` → `text-sm sm:text-base`

3. **LoginPage — Elementos removidos**
   - Texto "Bem-vindo de volta ao ANEST" → alterado para "Bem-Vindo à ANEST"
   - Footer "Suporte • Termos • Privacidade" removido completamente

4. **Manter conectado (checkbox)**
   - Checkbox customizado com ícone `Check` (lucide-react), marcado por padrão
   - Quando marcado: `browserLocalPersistence` (sessão sobrevive fechar browser)
   - Quando desmarcado: `browserSessionPersistence` (sessão expira ao fechar)
   - `setPersistence()` chamado antes de cada `login()` conforme escolha

5. **Autenticação Biométrica — Face ID / Touch ID (WebAuthn/FIDO2)**
   - **biometricService.js** NOVO: serviço completo com 6 funções exportadas
     - `isBiometricAvailable()` — detecta suporte via `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`
     - `hasBiometricRegistered()` — verifica se há credencial salva no localStorage
     - `getBiometricEmail()` — retorna email associado à biometria
     - `registerBiometric(email, password)` — registra credencial WebAuthn + cifra senha com AES-GCM (PBKDF2, 100k iterações, SHA-256)
     - `authenticateWithBiometric()` — verifica biometria via `navigator.credentials.get()` + decifra senha → retorna `{email, password}`
     - `removeBiometric()` — limpa dados do localStorage
   - **Config WebAuthn**: `authenticatorAttachment: 'platform'` (Face ID, Touch ID, Windows Hello), `userVerification: 'required'`, `residentKey: 'preferred'`
   - **Criptografia**: senha cifrada com AES-GCM, chave derivada do `credentialId` via PBKDF2. IV aleatório de 12 bytes. Armazenado em localStorage como `anest_biometric`
   - **Fluxo de registro**: usuário preenche email+senha → clica "Ativar Face ID / Touch ID" → prompt nativo do SO → credenciais cifradas + salvas → login automático
   - **Fluxo de autenticação**: clica "Entrar com Face ID / Touch ID" → prompt nativo → decifra senha → `login(email, password)` no Firebase
   - **UI adaptativa**: botão só aparece se dispositivo suporta; texto muda de "Ativar" para "Entrar com" após registro; ícones `ScanFace` + `Fingerprint`

6. **App.jsx — Reset de navegação pós-login**
   - Quando `!isAuthenticated` e `currentPage !== 'home'`: reseta `currentPage`, `activeNav`, `navigationHistory` e `pageParams`
   - Corrige bug onde o app ia para "Meu Perfil" em vez de "Home" após login

**Dependências:** Nenhuma nova. `lucide-react` (ScanFace, Fingerprint, Check já disponíveis). WebAuthn e Web Crypto API são nativos do browser.

**localStorage keys:** `anest_biometric` (dados biométricos cifrados)

---

### v3.39.0 (17/02/2026) - Reuniões DS Color Migration + Modal Fixes

**Escopo:** Migração completa de cores hardcoded para tokens DS em todo o módulo de Reuniões, correção de overflow em modais, reestruturação de Upload modals com padrão `Modal.Body` + `footer`.

**Arquivos modificados:**
- `src/design-system/components/ui/modal.jsx` (Modal.Body overflow fix)
- `src/design-system/components/ui/file-upload.jsx` (DS tokens completos)
- `src/components/reunioes/NovaReuniaoModal.jsx` (footer + Modal.Body + DS tokens)
- `src/components/reunioes/UploadSubsidioModal.jsx` (footer + Modal.Body + DS tokens)
- `src/components/reunioes/UploadAtaModal.jsx` (footer + Modal.Body + DS tokens)
- `src/pages/ReunioesPage.jsx` (DS tokens)
- `src/components/reunioes/ReuniaoCard.jsx` (DS tokens)
- `src/pages/reunioes/ReuniaoDetalhePage.jsx` (DS tokens)

**Correções implementadas:**

1. **Modal.Body Overflow Fix (DS-level)**
   ```jsx
   // Antes
   className="min-h-0 flex-1 overflow-auto pr-0 sm:pr-1"

   // Depois
   className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0 sm:pr-1"
   ```
   - Previne scroll horizontal dentro de modais
   - Afeta todos os consumidores de `Modal.Body` globalmente

2. **FileUpload DS Token Migration**
   - Todas as cores hardcoded (`#hex`) removidas do componente
   - Tokens aplicados: `text-primary`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `bg-card`, `bg-secondary`, `bg-accent`, `bg-primary`, `border-border`, `focus:ring-ring/30`
   - FilePreview sub-component também migrado

3. **NovaReuniaoModal - Reestruturação Completa**
   - Botões movidos de children (scroll area) para `footer` prop do Modal
   - Conteúdo envolvido em `<Modal.Body>` para scroll interno
   - FileUpload alterado de `variant="dropzone"` para `variant="button"` (mais compacto)
   - Preview de arquivo duplicado removido (FileUpload built-in preview)
   - Todas cores hardcoded migradas para DS tokens

4. **UploadSubsidioModal + UploadAtaModal - Reestruturação**
   - Padrão `Modal.Body` + `footer` prop aplicado (mesmo padrão de NovaReuniaoModal)
   - Botões hardcoded (`bg-[#006837]...`) migrados para `variant="default"`
   - Zero cores hex restantes

5. **Reuniões Pages - DS Color Migration (4 arquivos)**
   - Mapeamento aplicado:
     - `text-[#004225] dark:text-[#2ECC71]` → `text-primary`
     - `text-[#004225] dark:text-white` / `text-[#111827] dark:text-white` → `text-foreground`
     - `text-[#6B7280] dark:text-[#6B8178]` → `text-muted-foreground`
     - `text-[#DC2626] dark:text-[#E74C3C]` → `text-destructive`
     - `border-[#C8E6C9] dark:border-[#2A3F36]` → `border-border`
     - `bg-white dark:bg-[#1A2420]` → `bg-card`
     - `bg-[#F0FFF4] dark:bg-[#111916]` → `bg-background`
     - `hover:bg-[#E8F5E9] dark:hover:bg-[#243530]` → `hover:bg-secondary`
     - `focus-visible:ring-[#006837]...` → `focus-visible:ring-ring`
   - Exceções mantidas: `TIPO_COLORS` em ReuniaoCard (cores semânticas por tipo de reunião)

**Padrão de Modal com Footer (estabelecido):**
```jsx
const footerButtons = (
  <div className="flex gap-3 w-full">
    <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
    <Button onClick={handleSubmit} className="flex-1">Confirmar</Button>
  </div>
);

<Modal open={isOpen} onClose={handleClose} title="..." footer={footerButtons}>
  <Modal.Body>
    <div className="space-y-4">{/* form fields */}</div>
  </Modal.Body>
</Modal>
```
- Footer renderiza fora da área de scroll (via `Modal.Footer`)
- `Modal.Body` provê `overflow-y-auto overflow-x-hidden`
- Botões sempre visíveis independente do scroll

---

### v3.38.0 (16/02/2026) - Fix DocumentCard Layout

**Problema:** Cards de documentos no Centro de Gestão > Documentos exibiam títulos truncados em 1 linha e informações cortadas, com altura irregular no grid.

**Arquivos modificados:**
- `src/pages/management/components/DocumentCard.jsx` (320 linhas totais, modificadas linhas 96-312)

**Correções implementadas:**

1. **Layout Flex com Altura Uniforme**
   ```jsx
   // Card principal
   className="h-full flex flex-col"

   // CardContent
   className="p-4 flex-1 flex flex-col"

   // Content wrapper
   className="flex-1 min-w-0 flex flex-col"
   ```
   - Cards agora ocupam 100% da altura do grid cell
   - Flex column garante distribuição vertical adequada

2. **Título com Line-Clamp 2 Linhas**
   ```jsx
   // Antes
   className="text-base font-semibold truncate"

   // Depois
   className="text-base font-semibold line-clamp-2 leading-tight mb-1"
   ```
   - Permite títulos longos como "Protocolo de Decisão Compartilhada para Procedimentos de Alto Risco" serem exibidos em até 2 linhas
   - `leading-tight` melhora espaçamento entre linhas
   - `mb-1` adiciona margem inferior consistente

3. **Menu de Ações Reposicionado**
   - Movido do bloco de badges para ao lado do título
   - Classe `flex-shrink-0` garante que botão nunca encolhe
   - Melhor hierarquia visual: título + ações ficam juntos no topo

4. **Badges de Status em Linha Separada**
   ```jsx
   <div className="flex flex-wrap gap-2 mb-3">
     {/* Vencido / Pendente / Próximo da revisão */}
   </div>
   ```
   - Badges agora em div própria com `flex-wrap`
   - `whitespace-nowrap` nos textos previne quebras indesejadas
   - Icons com `flex-shrink-0` mantêm tamanho

5. **Metadata no Rodapé com mt-auto**
   ```jsx
   <div className="flex flex-wrap items-center gap-2 mt-auto">
     {/* Código, Versão, Status, Data */}
   </div>
   ```
   - `mt-auto` empurra metadata para o final do card
   - Cards de alturas diferentes mantêm metadata alinhada na base
   - Data quebra linha em mobile: `w-full sm:w-auto sm:ml-auto`

**Resultado:**
- ✅ Todos os cards têm altura uniforme no grid
- ✅ Títulos visíveis com até 2 linhas (sem truncamento agressivo)
- ✅ Layout organizado verticalmente: Título/Tipo → Badges → Metadata
- ✅ Informações sempre visíveis em mobile e desktop
- ✅ Grid 3 colunas mantém organização visual

**Componentes que usam DocumentCard:**
- `src/pages/management/documents/EticaSection.jsx` (grid 3 colunas)
- `src/pages/management/documents/ComitesSection.jsx` (grid 3 colunas)
- `src/pages/management/documents/AuditoriasSection.jsx` (grid 3 colunas)
- `src/pages/management/documents/RelatoriosSection.jsx` (grid 3 colunas)
- `src/pages/management/documents/BibliotecaSection.jsx` (grid 3 colunas)

**Referências no código:**
- Design System: Tailwind `line-clamp-{n}` utility
- Layout: Flexbox com `flex-col`, `flex-1`, `mt-auto`
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

### v3.37.0 (15/02/2026) - Fix Dashboard Executivo

- PDF Export funcional
- AdminOnly wrapper corrigido
- Modal Ciclo Qmentum polido
- BottomNav z-index fix
- KPI Trend null guards
- Proteções contra dados nulos

---

## 1. VISÃO GERAL DO PROJETO

### 1.1 O que é o ANEST?

Sistema de gestão de qualidade para **anestesiologia** usado por grupos médicos. Inclui:
- Gestão de plantões e escalas
- Comunicados internos
- Calculadoras clínicas (25+)
- Sistema de qualidade (ROPs) com gamificação
- Indicadores de desempenho (KPIs)
- **Biblioteca de documentos com grid 2 colunas e filtros por tipo**
- **Sistema de versionamento de documentos**
- **Ferramentas de administrador para gestão documental**
- **Centro de Gestão com 9 abas (Usuários, Emails, Docs, Stats, Comunicados, Incidentes, Residência + Docs sub-tabs)**

### 1.2 Objetivo do Design System

Transformar um app legado (11.280 linhas em um único app.js) em um sistema moderno, componentizado e mantível.

### 1.3 Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | React | 19.x |
| Build | Vite | 7.x |
| Estilos | Tailwind CSS | 3.x |
| Animações | Framer Motion | 11.x |
| Ícones | Lucide React | latest |
| Charts | Recharts | 2.15.x |
| PDF Viewer | react-pdf + pdfjs-dist | 9.x / 4.x |
| Zoom/Pan | react-zoom-pan-pinch | 3.x |
| Backend | Firebase | 9.x (modular) |
| Padrões UI | Shadcn/ui patterns | - |

### 1.4 Princípios de Design

```
+-------------------------------------------------------+
|  PRINCÍPIOS ANEST                                      |
+-------------------------------------------------------+
|  1. iOS Fintech-inspired - Visual limpo e profissional |
|  2. Mobile-first - Funciona perfeitamente em celulares |
|  3. Dual Theme - Light e Dark mode obrigatórios        |
|  4. Acessibilidade - WCAG 2.1 AA compliance            |
|  5. Performance - Animações suaves, carregamento rápido|
|  6. Consistência - Mesmos padrões em todas as telas    |
+-------------------------------------------------------+
```

---

## 2. ARQUITETURA E ESTRUTURA

### 2.1 Estrutura de Diretórios

```
web/
+-- src/
|   +-- design-system/
|   |   +-- components/
|   |   |   +-- ui/                    # 57 primitivos reutilizáveis
|   |   |   +-- anest/                 # 24 componentes específicos ANEST
|   |   |   +-- communication/         # 5 componentes de comunicação (mensagens & notificações)
|   |   |   +-- composed/              # Componentes compostos
|   |   |   +-- index.js               # Export centralizado
|   |   |
|   |   +-- hooks/                     # 10+ hooks customizados
|   |   |   +-- useTheme.jsx
|   |   |   +-- useMediaQuery.jsx
|   |   |   +-- useResponsiveValue.jsx
|   |   |   +-- useMobileLayout.jsx
|   |   |   +-- index.js
|   |   |
|   |   +-- showcase/                  # 13 showcases de documentação
|   |   |   +-- ShowcaseIndex.jsx      # Layout principal
|   |   |   +-- ComponentShowcase.jsx
|   |   |   +-- FormShowcase.jsx
|   |   |   +-- CalculatorShowcase.jsx
|   |   |   +-- ... (10 outros)
|   |   |
|   |   +-- data/                      # Dados de calculadoras
|   |   |   +-- calculator-definitions.js
|   |   |
|   |   +-- utils/
|   |   |   +-- tokens.js              # cn() utility
|   |   |
|   |   +-- Tokens.json                # Design tokens
|   |   +-- LightMode.jsx              # Referência Light
|   |   +-- DarkMode.jsx               # Referência Dark
|   |   +-- index.js                   # Export principal
|   |
|   +-- pages/                         # Páginas do app
|   |   +-- kpi/                       # Sub-páginas KPI (6)
|   |   +-- comites/                   # Sub-páginas Comitês (9)
|   |   +-- etica/                     # Sub-páginas Ética (5)
|   |   +-- auditorias/                # Sub-páginas Auditorias (5)
|   |   +-- relatorios/                # Sub-páginas Relatórios (3)
|   |   +-- desastres/                 # Sub-páginas Desastres (10)
|   |   +-- incidents/                 # Páginas de Incidentes
|   |   +-- rops/                      # Desafio ROPs - Quiz Gamificado (6)
|   |   +-- educacao/                  # Sub-páginas Educação Continuada (11)
|   |   +-- faturamento/               # Módulo Faturamento (9 páginas)
|   |   +-- management/                # Centro de Gestão Qmentum
|   |   +-- communication/             # Páginas de Comunicação
|   |   +-- dashboard/                  # Dashboard Executivo (DashboardExecutivoPage)
|   +-- services/                      # Firebase services + PDF + biometricService.js (WebAuthn Face ID/Touch ID)
|   +-- contexts/                      # React contexts
|   +-- hooks/                         # Hooks globais
|   +-- data/                          # Dados estáticos
|   +-- assets/                        # Imagens/ícones
|   +-- styles/                        # CSS global
|   +-- App.jsx
|   +-- main.jsx
|
+-- public/
+-- CLAUDE_CONTEXT.md                  # Este arquivo
+-- package.json
+-- tailwind.config.js
+-- vite.config.js
+-- index.html
```

---

## 3. DESIGN SYSTEM - ESPECIFICAÇÕES

### 3.1 Paleta de Cores

#### Light Mode
```javascript
const lightColors = {
  // Fundos - Hierarquia de Superfícies
  bgPrimary: '#F0FFF4',        // Nível 0: Fundo principal (verde pálido)
  cardElevated: '#E8F5E9',     // Nível 1: Containers de seção
  bgCard: '#FFFFFF',           // Nível 2: Cards brancos
  cardLight: '#D4EDDA',        // Card destaque (comunicados)
  cardAccent: '#C8E6C9',       // Bordas padrão

  // Bordas (tokens Tailwind disponíveis)
  borderDefault: '#C8E6C9',    // Borda padrão → border-border
  borderStrong: '#A5D6A7',     // Borda forte → border-border-strong

  // Verdes institucionais
  greenDarkest: '#002215',     // Texto principal verde
  greenDark: '#004225',        // Botões, badges, avatar
  greenMedium: '#006837',      // Ícones, links
  greenBright: '#2E8B57',      // Destaques
  greenLight: '#9BC53D',       // Horários, acentos

  // Textos
  textPrimary: '#000000',      // Títulos
  textSecondary: '#6B7280',    // Subtítulos
  textMuted: '#9CA3AF',        // Placeholders

  // Status
  success: '#34C759',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#007AFF',
};
```

#### Dark Mode
```javascript
const darkColors = {
  // Fundos
  bgPrimary: '#111916',        // Fundo principal
  bgCard: '#1A2420',           // Cards
  bgCardLight: '#243530',      // Cards secundários

  // Verdes (mais vibrantes para contraste)
  greenPrimary: '#2ECC71',     // Verde principal
  greenLight: '#58D68D',       // Verde claro
  greenMuted: '#1E8449',       // Verde escuro
  greenDark: '#145A32',        // Verde muito escuro
  greenGlow: 'rgba(46, 204, 113, 0.15)', // Efeito glow

  // Textos
  textPrimary: '#FFFFFF',      // Títulos
  textSecondary: '#A3B8B0',    // Subtítulos
  textMuted: '#6B8178',        // Placeholders

  // Status
  success: '#2ECC71',
  warning: '#F39C12',
  error: '#E74C3C',
  info: '#3498DB',
};
```

### 3.2 Hierarquia de Superfícies

| Nível | Light Mode | Dark Mode | Uso |
|-------|------------|-----------|-----|
| 0 | `#F0FFF4` | `#111916` | Fundo da página |
| 1 | `#E8F5E9` | `#1A2420` | Containers de seção |
| 2 | `#FFFFFF` | `#1A2420` | Cards |
| Borda | `#A5D6A7` | `#2A3F36` | Separação forte (`border-border-strong`) |

### 3.3 Tipografia

```javascript
const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",

  scale: {
    h1: { fontSize: '20px', fontWeight: 700 },
    h2: { fontSize: '20px', fontWeight: 700 },
    h3: { fontSize: '18px', fontWeight: 700 },
    h4: { fontSize: '16px', fontWeight: 700 },
    body: { fontSize: '15px', fontWeight: 600 },
    bodySmall: { fontSize: '14px', fontWeight: 500 },
    caption: { fontSize: '13px', fontWeight: 500 },
    small: { fontSize: '12px', fontWeight: 500 },
    tiny: { fontSize: '11px', fontWeight: 600 },
    micro: { fontSize: '10px', fontWeight: 500 },
  }
};
```

### 3.4 Espaçamentos

```javascript
const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '40px',
};
```

### 3.5 Border Radius

```javascript
const borderRadius = {
  sm: '10px',      // Badges
  md: '12px',      // Ícones, botões
  lg: '16px',      // Search bar, inputs
  xl: '20px',      // Cards
  full: '50%',     // Avatares, atalhos
};
```

### 3.6 Sombras

```javascript
const shadows = {
  light: {
    sm: '0 2px 8px rgba(0,66,37,0.08)',
    md: '0 2px 12px rgba(0,66,37,0.1)',
    lg: '0 4px 16px rgba(0,66,37,0.15)',
    avatar: '0 4px 16px rgba(0,66,37,0.3)',
  },
  dark: {
    sm: '0 2px 8px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 6px 20px rgba(0,0,0,0.5)',
    glow: '0 0 20px rgba(46, 204, 113, 0.3)',
  },
};
```

---

## 4. COMPONENTES UI

### 4.1 Lista Completa (57 componentes)

#### Primitivos Base
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Button` | button.jsx | Botão com variants e sizes |
| `Card` | card.jsx | Container com header/footer |
| `Badge` | badge.jsx | Labels e tags |
| `Avatar` | avatar.jsx | Imagem de perfil |
| `Input` | input.jsx | Campo de texto |
| `Skeleton` | skeleton.jsx | Loading placeholder |
| `WidgetCard` | widget-card.jsx | Card para widgets |
| `AppIcon` | app-icon.jsx | Ícone de aplicativo |
| `WidgetGrid` | widget-grid.jsx | Grid de widgets |
| `QuickLinksCard` | quick-links-card.jsx | Card de links rápidos |

#### Formulários (8 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Select` | select.jsx | Dropdown customizado |
| `Checkbox` | checkbox.jsx | Checkbox com label |
| `RadioGroup/RadioItem` | radio.jsx | Radio buttons |
| `Textarea` | textarea.jsx | Campo multilinhas |
| `Switch` | switch.jsx | Toggle on/off |
| `DatePicker` | date-picker.jsx | Seletor de data |
| `FileUpload` | file-upload.jsx | Upload de arquivos (dropzone/button variants, DS tokens, built-in FilePreview) |
| `FormField` | form-field.jsx | Wrapper de campo |

#### Feedback (7 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Toast` | toast.jsx | Notificações temporárias |
| `Modal` | modal.jsx | Diálogo modal (Modal.Body: overflow-y-auto overflow-x-hidden; footer prop para botões fora do scroll) |
| `Alert` | alert.jsx | Mensagens de alerta |
| `Progress` | progress.jsx | Barra de progresso |
| `Spinner` | spinner.jsx | Loading spinner |
| `EmptyState` | empty-state.jsx | Estados vazios |
| `ConfirmDialog` | confirm-dialog.jsx | Diálogo de confirmação |

#### Navegação (7 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Tabs` | tabs.jsx | Navegação por abas |
| `Breadcrumb` | breadcrumb.jsx | Trilha de navegação |
| `DropdownMenu` | dropdown.jsx | Menu dropdown |
| `Sidebar` | sidebar.jsx | Barra lateral |
| `NavLink` | nav-link.jsx | Link de navegação |
| `Pagination` | pagination.jsx | Paginação |
| `Stepper` | stepper.jsx | Wizard steps |

#### Responsividade (10 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `ResponsiveContainer` | responsive-container.jsx | Container responsivo |
| `ResponsiveGrid` | responsive-container.jsx | Grid responsivo |
| `ResponsiveStack` | responsive-container.jsx | Stack responsivo |
| `ShowAt` | responsive-container.jsx | Mostra em breakpoint |
| `HideAt` | responsive-container.jsx | Esconde em breakpoint |
| `MobileOnly` | responsive-container.jsx | Apenas mobile |
| `TabletOnly` | responsive-container.jsx | Apenas tablet |
| `DesktopOnly` | responsive-container.jsx | Apenas desktop |
| `MobileAndTablet` | responsive-container.jsx | Mobile + tablet |
| `TabletAndDesktop` | responsive-container.jsx | Tablet + desktop |

#### Data Display (8 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Table` | table.jsx | Tabela com sort/filter |
| `DataGrid` | data-grid.jsx | Grid paginado |
| `Calendar` | calendar.jsx | Calendário de eventos |
| `Timeline` | timeline.jsx | Linha do tempo |
| `ChartContainer` | chart.jsx | Container de gráficos |
| `DonutChart` | donut-chart.jsx | Gráfico de rosca (recharts PieChart/Pie/Cell/Sector) |
| `SparklineChart` | sparkline-chart.jsx | Mini gráfico |

#### Utilitários (7 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Tooltip` | tooltip.jsx | Tooltip com delay |
| `Popover` | popover.jsx | Popover clicável |
| `Accordion` | accordion.jsx | Sanfona expansível |
| `Collapsible` | collapsible.jsx | Expansível simples |
| `ScrollArea` | scroll-area.jsx | Área com scroll |
| `Separator` | separator.jsx | Linha separadora |
| `AspectRatio` | aspect-ratio.jsx | Proporção de aspecto |

#### Mídia (4 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `AudioPlayer` | audio-player.jsx | Player de áudio |
| `VideoPlayer` | video-player.jsx | Player de vídeo |
| `PDFViewer` | pdf-viewer.jsx | Visualizador PDF |
| `QRCode` | qr-code.jsx | Gerador QR Code (biblioteca `qrcode`) |

#### Gamificação (4 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `Quiz` | quiz.jsx | Quiz interativo |
| `Leaderboard` | leaderboard.jsx | Ranking/Pódio |
| `Achievement` | achievement.jsx | Badges/Conquistas |
| `Checklist` | checklist.jsx | Lista de tarefas |

#### Decorativos (2 componentes)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `AnimatedBackground` | animated-background.jsx | Fundos animados (circles, dots, gradient, mesh, combined). Gradiente `from-[#006837] to-[#00894B]`, círculos `border-[#2ECC71]/40`, dots `bg-[#2ECC71]/40` |
| `Carousel` | carousel.jsx | Carrossel de slides |

### 4.2 Exemplo de Uso

```jsx
import {
  Button,
  Card,
  Input,
  Select,
  Modal,
  Toast,
  useToast,
} from '@/design-system/components/ui';

function MyComponent() {
  const { toast } = useToast();

  return (
    <Card>
      <Input placeholder="Digite algo..." />
      <Select
        options={[
          { value: 'opt1', label: 'Opção 1' },
          { value: 'opt2', label: 'Opção 2' },
        ]}
        onChange={(val) => console.log(val)}
      />
      <Button onClick={() => toast({ title: 'Sucesso!' })}>
        Salvar
      </Button>
    </Card>
  );
}
```

---

## 5. COMPONENTES ANEST

### 5.1 Lista Completa (24 componentes)

#### List Items
| Componente | Descrição |
|------------|-----------|
| `ListItem` | Item de lista genérico |
| `PlantaoListItem` | Item de plantão |
| `FeriasListItem` | Item de férias |
| `ComunicadoItem` | Item de comunicado |

#### Cards
| Componente | Descrição |
|------------|-----------|
| `SectionCard` | Card de seção |
| `ComunicadosCard` | Card de comunicados |
| `PlantaoCard` | Card wrapper de plantões |
| `FeriasCard` | Card wrapper de férias |
| `ComunicadoCard` | Card individual de comunicado |
| `ROPProgressCard` | Card de progresso ROP |
| `KPICard` | Card de indicador (v2 com modal) |
| `CalculadoraCard` | Card de calculadora |

#### KPI Management
| Componente | Descrição |
|------------|-----------|
| `KPIDataProvider` | Context provider de KPIs com localStorage isolado por `storageKey` |
| `useKPIData` | Hook para dados de KPIs (kpis, updateKPI, addKPI, removeKPI, resetToDefault) |
| `KPIEditor` | Editor completo de KPIs com modal de edição (12 meses) |
| `KPIEditorCompact` | Editor compacto inline |

**KPIDataProvider Props:**
```jsx
<KPIDataProvider
  initialData={arrayDeKPIs}      // Dados iniciais (opcional)
  storageKey="minha-chave"       // Chave do localStorage (padrão: "anest-kpi-data")
>
  <App />
</KPIDataProvider>
```

**Estrutura de um KPI:**
```javascript
{
  id: "taxa-infeccao",
  titulo: "Taxa de Infecção Hospitalar",
  valor: 3.2,                    // Último valor válido (não-null)
  meta: 3.0,
  metaLabel: "≤3%",
  unidade: "%",
  periodo: "Set",                // Mês do último dado válido
  accentColor: "green",          // green | blue | orange | red | purple | cyan
  isLowerBetter: true,           // true = menor é melhor (taxa infecção)
  historico: [2.8, 3.1, 2.9, 3.0, 3.2, 2.7, 3.1, 2.9, 3.2, null, null, null],  // 12 meses
  mesesLabels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
}
```

**Importante:** O KPICard filtra automaticamente valores `null` no gráfico e no cálculo de média anual.

#### Navegação & Layout
| Componente | Descrição |
|------------|-----------|
| `Header` | Cabeçalho do app (Avatar 52px + Sino 44px) |
| `SearchBar` | Barra de busca |
| `BottomNav` | Navegação inferior com 4 abas |
| `QuickLinksGrid` | Grid de atalhos (33 opções em 7 categorias) |
| `NotificationBell` | Sino de notificações (44px) |
| `BackButton` | Botão voltar |

##### Header - Hierarquia Visual (v3.12.0)

O Header segue princípios de hierarquia visual baseados em pesquisa de UI/UX:

| Elemento | Tamanho | Propósito |
|----------|---------|-----------|
| Avatar | **52px** | Identidade do usuário (foco principal) |
| Sino | **44px** | Ação utilitária (secundário) |

**Diferença de 8px** cria hierarquia visual clara onde o avatar domina o layout.

**Arquivos:**
- `src/design-system/components/ui/avatar.jsx` → size "lg": 52px
- `src/design-system/components/anest/header.jsx` → sino: 44px

##### BottomNav - Ícones Disponíveis

O componente `BottomNav` suporta os seguintes ícones via string:

| Ícone | String | Tamanho | Uso |
|-------|--------|---------|-----|
| Home | `"Home"` | 28px/32px | Aba inicial |
| Shield | `"Shield"` | 28px/32px | Aba de gestão |
| GraduationCap | `"GraduationCap"` | 30px/34px* | Aba de educação |
| Menu | `"Menu"` | 28px/32px | Aba de menu |
| FileText | `"FileText"` | 28px/32px | Documentos |
| Calculator | `"Calculator"` | 28px/32px | Calculadoras |

*GraduationCap tem tamanho maior para compensar visualmente o design mais fino.

**Exemplo de uso:**
```jsx
<BottomNav
  items={[
    { icon: "Home", active: activeNav === "home", id: "home" },
    { icon: "Shield", active: activeNav === "shield", id: "shield" },
    { icon: "GraduationCap", active: activeNav === "education", id: "education" },
    { icon: "Menu", active: activeNav === "menu", id: "menu" },
  ]}
  onItemClick={handleNavClick}
/>
```

**Comportamento dos ícones:**
- Quando `active: true`, o ícone fica preenchido (`fill="currentColor"`)
- Quando `active: false`, o ícone fica apenas com contorno (`fill="none"`)

#### Controle de Permissão
| Componente | Descrição |
|------------|-----------|
| `AdminOnly` | Wrapper para admins |
| `RequirePermission` | Wrapper por permissão |
| `RoleGate` | Gate por role |
| `CanWrite/CanCreate/CanEdit/CanDelete` | Wrappers de ação |

#### Botões Admin
| Componente | Descrição |
|------------|-----------|
| `AddButton` | Botão adicionar |
| `EditButton` | Botão editar |
| `DeleteButton` | Botão deletar |
| `UploadButton` | Botão upload |
| `AdminActionBar` | Barra de ações admin |

#### Calculadoras
| Componente | Descrição |
|------------|-----------|
| `ScoreTracker` | Rastreador de score |
| `RiskFactorCard` | Card de fator de risco |

### 5.2 Exemplo de Uso

```jsx
import {
  Header,
  SearchBar,
  KPICard,
  BottomNav,
  AdminOnly,
  AddButton,
} from '@/design-system/components/anest';

function Dashboard() {
  return (
    <>
      <Header userName="Dr. Silva" />
      <SearchBar placeholder="Buscar..." />

      <KPICard
        titulo="Taxa de Conformidade"
        valor={92.5}
        meta={90}
        metaLabel=">=90%"
        unidade="%"
        periodo="Set"
        icon={<Shield />}
        accentColor="green"
        isLowerBetter={false}
        historico={[88, 89, 91, 90, 92, 91, 93, 92, 92.5, null, null, null]}
        mesesLabels={["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]}
      />

      <AdminOnly>
        <AddButton onClick={handleAdd} />
      </AdminOnly>

      <BottomNav activeTab="home" />
    </>
  );
}
```

---

## 6. HOOKS

### 6.1 Lista Completa (18+ hooks)

| Hook | Arquivo | Descrição |
|------|---------|-----------|
| `useTheme` | useTheme.jsx | Toggle light/dark |
| `ThemeProvider` | useTheme.jsx | Provider de tema |
| `useMediaQuery` | useMediaQuery.jsx | Detecta media query |
| `useBreakpoint` | useMediaQuery.jsx | Breakpoint atual |
| `useIOSDevice` | useMediaQuery.jsx | Detecta iOS/notch |
| `useResponsiveValue` | useResponsiveValue.jsx | Valor por breakpoint |
| `useResponsiveColumns` | useResponsiveValue.jsx | Colunas responsivas |
| `useResponsivePadding` | useResponsiveValue.jsx | Padding responsivo |
| `useMobileLayout` | useMobileLayout.jsx | Layout mobile |
| `usePriorityColumns` | useMobileLayout.jsx | Colunas prioritárias |
| `useToast` | toast.jsx | Sistema de toasts |
| `useCarousel` | carousel.jsx | Controle de carrossel |
| `useEscalaDia` | usePegaPlantao.js | Dados de plantões do dia (API Pega Plantão) |
| `useEticaDocumentos` | useEticaDocumentos.js | CRUD documentos ética/bioética (Firebase) |
| `useDocuments` | useDocuments.js | Documentos + compliance + alertas de revisão (v3.26) |
| `useDocumentsByCategory` | useDocumentsByCategory.js | Filtros por categoria com busca/sort |
| `useDocumentActions` | useDocumentActions.js | CRUD com toast feedback e loading states |
| `useComplianceMetrics` | useComplianceMetrics.js | Score Qmentum ponderado + métricas ROP (v3.26) |
| `useQualidadeDashboard` | useQualidadeDashboard.js | Dashboard consolidado Qmentum: score geral, nivel, 4 sub-scores, alertas, narrative, insights, nextSteps, achievements (v3.36) |
| `useAutoavaliacao` | AutoavaliacaoContext.jsx | Context de autoavaliação ROPs: avaliacoes, cicloAtual, setCiclo, CRUD, progresso por area (v3.36) |
| `useDashboardExecutivo` | useDashboardExecutivo.js | Hook consolidado do Dashboard Executivo: agrega useQualidadeDashboard + useComplianceMetrics + useIncidents + KPI. Retorna scoreGeral, subScores, alerts, narrative, insights, nextSteps, achievements, autoavaliacao, auditorias, planos, kpis, coverageChartData, incidents. Null guards em incidents.incidentes/denuncias e compliance.documentCoverage (v3.37) |
| `useResidencia` | useResidencia.js | Dados de residência médica com error handling (toast), reconexão automática via `createFirestoreSubscription`, state `connectionStatus` (connected/reconnecting/error) (v3.43) |
| `useStaff` | useStaff.js | Dados de funcionários (staff) com error handling (toast), reconexão automática via `createFirestoreSubscription`, state `connectionStatus`, inicializa `staff` como `null` (v3.43) |
| `useInfraStatus` | useInfraStatus.js | Health check de infraestrutura: `saveHealthCheck()` persiste em `infra_health_history`, `cleanupOldHealthChecks()` remove >90 dias, probe de `lgpd_solicitacoes` (v3.43) |

### 6.2 useTheme

```jsx
import { useTheme, ThemeProvider } from '@/design-system/hooks';

// No App.jsx
function App() {
  return (
    <ThemeProvider>
      <MyApp />
    </ThemeProvider>
  );
}

// Em qualquer componente
function MyComponent() {
  const { isDark, toggleTheme, setTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
```

### 6.3 useBreakpoint

```jsx
import { useBreakpoint } from '@/design-system/hooks';

function MyComponent() {
  const {
    breakpoint,   // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    isMobile,     // < 768px
    isTablet,     // 768-1023px
    isDesktop,    // >= 1024px
    isPortrait,
    isLandscape,
    isTouchDevice,
  } = useBreakpoint();

  return isMobile ? <MobileView /> : <DesktopView />;
}
```

### 6.4 useResponsiveValue

```jsx
import { useResponsiveValue } from '@/design-system/hooks';

function MyComponent() {
  const columns = useResponsiveValue({
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4
  });

  return (
    <div style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {/* content */}
    </div>
  );
}
```

---

## 7. SHOWCASES

### 7.1 Lista de Showcases (16 showcases)

| Showcase | Arquivo | Descrição |
|----------|---------|-----------|
| `NewComponentsShowcase` | NewComponentsShowcase.jsx | Novos componentes |
| `GestaoDocumentalShowcase` | GestaoDocumentalShowcase.jsx | **Componentes de Gestão Documental** |
| `CentroGestaoShowcase` | CentroGestaoShowcase.jsx | **Centro de Gestão Qmentum** (v3.26) |
| `PlantoesShowcase` | PlantoesShowcase.jsx | Sistema de Plantões |
| `CalculatorShowcase` | CalculatorShowcase.jsx | Calculadoras médicas |
| `PagesShowcase` | PagesShowcase.jsx | Páginas do app |
| `ColorPalette` | ColorPalette.jsx | Paleta de cores |
| `ComponentShowcase` | ComponentShowcase.jsx | Primitivos UI |
| `NavigationShowcase` | NavigationShowcase.jsx | Navegação |
| `FormShowcase` | FormShowcase.jsx | Formulários |
| `FeedbackShowcase` | FeedbackShowcase.jsx | Feedback |
| `ResponsiveShowcase` | ResponsiveShowcase.jsx | Responsividade |
| `DataDisplayShowcase` | DataDisplayShowcase.jsx | Data Display |
| `UtilitiesShowcase` | UtilitiesShowcase.jsx | Utilitários |
| `GamificationShowcase` | GamificationShowcase.jsx | Gamificação |
| `AnestShowcase` | AnestShowcase.jsx | Componentes ANEST |

### 7.3 Centro de Gestão Showcase (NOVO v3.26.0)

Demonstra todos os componentes do Centro de Gestão com 10 seções interativas (945 linhas):

| Seção | Componentes |
|-------|-------------|
| ManagementLayout | Sidebar com navegação entre abas |
| DocumentCard | Variantes e estados (ativo, vencido, pendente) - **v3.38.0: Layout flex com altura uniforme, título line-clamp-2, metadata mt-auto** |
| FilterBar | Busca + filtros + ações em lote |
| StatsCard | Métricas com cores e tendências |
| ComplianceDashboard | Dashboard de conformidade Qmentum |
| ApprovalQueue | Fila de aprovações pendentes |
| ReviewCalendar | Calendário de revisões |
| AuditTrailModal | Trilha de auditoria com filtros |
| PermissionsModal | Gestão de permissões por role |
| Demo Completa | Simulação integrada do Centro de Gestão |

**Registrado no ShowcaseIndex** como `centroGestao` com label "Centro de Gestao" e ícone `Settings`.

### 7.4 Gestão Documental Showcase (v3.15.2)

Demonstra todos os componentes usados em BibliotecaPage e RelatoriosPage:

| Componente | Descrição |
|------------|-----------|
| `StatCard` | Widget de estatística (grid 3 colunas) |
| `PageHeader` | Header com ícone + título + contador |
| `SearchBar` | Campo de busca do Design System |
| `SectionHeader` | Accordion colapsável com ícone, título, contador e chevron |
| `DocumentoCard` | Card de documento com badge, título, código e versão |
| `EmptyState` | Feedback visual para resultados vazios |
| `LoadingState` | Spinner de carregamento |
| `InfoFooter` | Notas informativas no rodapé |

**Seções do Showcase:**
1. Widgets de Estatísticas
2. Header com Ícone e Contador
3. Campo de Busca
4. Accordion - SectionHeader (estados e interativo)
5. Grid de DocumentoCard
6. Accordion Completo com Cards
7. Estado Vazio
8. Estado de Carregamento
9. Rodapé Informativo
10. Demo Completa da Página

### 7.2 ShowcaseIndex

O `ShowcaseIndex.jsx` é o layout principal que une todos os showcases com navegação lateral.

**Comportamento:**
- Default abre em "Novos" (NewComponentsShowcase)
- Mobile: sidebar abre automaticamente como drawer
- Toggle Light/Dark mode no topo da sidebar
- Botão "Fechar Showcase" para voltar ao app

---

## 8. RESPONSIVIDADE

### 8.1 Breakpoints

```javascript
const breakpoints = {
  xs: { max: 479, label: 'Mobile pequeno (iPhone SE)' },
  sm: { min: 480, max: 639, label: 'Mobile (iPhone standard)' },
  md: { min: 640, max: 767, label: 'Mobile grande (iPhone Pro Max)' },
  lg: { min: 768, max: 1023, label: 'Tablet (iPad Mini/Air)' },
  xl: { min: 1024, max: 1439, label: 'Desktop/Tablet grande (iPad Pro)' },
  '2xl': { min: 1440, label: 'Desktop grande' },
};
```

### 8.2 Tailwind Classes

```css
/* Mobile first - classes sem prefixo são para mobile */
/* sm: 480px+ */
/* md: 640px+ */
/* lg: 768px+ */
/* xl: 1024px+ */
/* 2xl: 1440px+ */

/* Exemplo */
.component {
  @apply p-4 lg:p-6 xl:p-8;
  @apply text-sm lg:text-base;
  @apply grid-cols-1 md:grid-cols-2 lg:grid-cols-3;
}
```

### 8.3 Comportamentos Responsivos

| Componente | Mobile | Tablet | Desktop |
|------------|--------|--------|---------|
| Tabs | Scroll horizontal | Todas visíveis | Todas visíveis |
| Breadcrumb | Primeiro + ... + último | Até 4 itens | Todos os itens |
| Dropdown | Bottom Sheet | Dropdown | Dropdown |
| Sidebar | Drawer overlay | Collapsed | Fixa expandida |
| Cards | 1 coluna | 2 colunas | 3-4 colunas |
| Modal | Fullscreen | Centered | Centered |
| Table | Cards/Accordion | Scroll horizontal | Tabela completa |

### 8.4 Mobile Layouts para Table/DataGrid

```javascript
const mobileLayoutOptions = {
  auto: 'Automaticamente usa Cards no mobile',
  scroll: 'Mantém tabela com scroll horizontal',
  cards: 'Cada linha vira um card empilhado',
  accordion: 'Mostra colunas principais + expand',
};
```

### 8.5 Touch Targets

```
+-------------------------------------------------------+
|  REGRA DE OURO: Touch targets MÍNIMO 44x44px           |
|                                                        |
|  - Botões: min-height 44px                             |
|  - Links: padding suficiente para 44px de altura       |
|  - Ícones clicáveis: container 44x44px                 |
|  - Checkboxes/Radios: área clicável 44x44px            |
|  - Inputs: min-height 44px                             |
|  - List items: min-height 44px                         |
+-------------------------------------------------------+
```

---

## 9. PADRÕES DE CÓDIGO

### 9.1 Estrutura de Componente

```jsx
// Imports organizados
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '@/design-system/utils/tokens';
import { useTheme } from '../hooks/useTheme';

// Variantes com CVA
const componentVariants = cva(
  "base-classes here",
  {
    variants: {
      variant: {
        default: "default-classes",
        secondary: "secondary-classes",
      },
      size: {
        sm: "small-classes",
        md: "medium-classes",
        lg: "large-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// Componente
export function ComponentName({
  variant,
  size,
  className,
  children,
  ...props
}) {
  const { isDark } = useTheme();

  return (
    <motion.div
      className={cn(componentVariants({ variant, size }), className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default ComponentName;
```

### 9.2 Padrão de Cores

```jsx
// CORRETO - usando tokens semânticos do Design System (CSS variables)
<div className="bg-card text-card-foreground border-border">
<div className="bg-background text-foreground">
<div className="text-muted-foreground">
<div className="bg-primary text-primary-foreground">
<div className="bg-destructive text-destructive-foreground">
<div className="bg-warning text-white">
<div className="hover:bg-muted">

// CORRETO - hierarquia de superfícies
// Nível 0: Página
<div className="bg-background">

// Nível 1: Container de seção
<div className="bg-secondary">

// Nível 2: Cards (borda padrão)
<div className="bg-card border-border">

// Nível 2: Cards (borda forte — padrão DS para cards de listagem)
<div className="bg-card border-border-strong">

// CORRETO - bordas de cards
<div className="bg-card rounded-[20px] border border-border-strong shadow-[...] p-4">
// border-border-strong → #A5D6A7 (light) / #2A3F36 (dark)

// CORRETO - status colors com tokens
<span className="text-destructive">    // #DC2626 (ambos modos)
<span className="text-muted-foreground"> // #6B7280 (light) / #8B9A93 (dark)

// ERRADO - NÃO usar hex hardcoded com dark: prefix
// <div className="bg-white dark:bg-[#1A2420]">         ← usar bg-card
// <div className="text-black dark:text-white">          ← usar text-foreground
// <div className="text-[#6B7280] dark:text-[#A3B8B0]"> ← usar text-muted-foreground
// <div className="border-[#C8E6C9] dark:border-[#2A3F36]"> ← usar border-border
// <div className="border-[#A5D6A7] dark:border-[#2A3F36]"> ← usar border-border-strong
// <div className="bg-[#006837] dark:bg-[#2ECC71]">     ← usar bg-primary
// <div className="bg-muted dark:bg-[#243530]">          ← usar bg-muted (já resolve para #243530 no dark)
// <div className="text-[#DC2626]">                      ← usar text-destructive
```

**Tokens de borda disponíveis no Tailwind:**
| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `border-border` | `#C8E6C9` | `#2A3F36` | Separadores, navbars, dividers, form controls |
| `border-border-strong` | `#A5D6A7` | `#2A3F36` | Bordas de cards de listagem (padrão DS) |

**Exceções permitidas:** cores dinâmicas por categoria (ex: `--notif-color` em notification-card), cores de status inline em config objects (ex: BUTTONS array), dados de gráficos (DonutChart), backgrounds tintados sem token (ex: `bg-[#FEF2F2]`), e shadows com rgba.

### 9.3 Animações com Framer Motion

```jsx
// Animações padrão
const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2 }
};

const scalePress = {
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 400, damping: 17 }
};
```

### 9.4 Acessibilidade (A11y)

```jsx
// Sempre incluir ARIA attributes
<button
  role="button"
  aria-label="Fechar modal"
  aria-expanded={isOpen}
  aria-controls="modal-content"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onClick()}
>

// Focus visible
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"

// Screen reader only
<span className="sr-only">Texto para leitores de tela</span>
```

---

## 10. CALCULADORAS MÉDICAS

### 10.1 Propriedades Especiais

#### `useDropdown: true`
Força dropdown em vez de SelectAsCards para calculadoras com muitas opções.

```javascript
{
  id: 'ped_glasgow',
  title: 'Glasgow Pediátrico',
  useDropdown: true,  // Força dropdown
  inputs: [...],
  compute: (values) => {...}
}
```

**Calculadoras com `useDropdown: true`:**
- `ped_glasgow` - Glasgow Pediátrico
- `ped_steward` - Escore de Steward
- `ped_pews` - PEWS
- `ped_psofa` - pSOFA
- `ped_pim3` - PIM3
- `ped_prism3` - PRISM III
- `ped_flacc` - FLACC
- `ped_cheops` - CHEOPS
- `ped_perdas_sang` - Perdas Sanguíneas Pediátricas

#### `customRender`
Permite renderização customizada para calculadoras especiais.

```javascript
{
  id: 'ped_holliday_segar',
  title: 'Holliday-Segar',
  customRender: 'hollidaySegar',  // Renderização customizada
  inputs: [...],
  compute: (values) => {...}
}
```

**Calculadoras com `customRender`:**
- `pedicalc` - PediCalc (peso integrado no header)
- `via_aerea` - Via Aérea Pediátrica
- `desfibrilacao` - Desfibrilação Pediátrica
- `fita_broselow` - Fita de Broselow
- `ped_holliday_segar` / `hemo_holliday` - Holliday-Segar

### 10.2 Visual Feedback no Select

Quando uma opção é selecionada no dropdown:
1. **Borda verde**: `border-[#006837] dark:border-[#2ECC71]`
2. **Fundo destacado**: `bg-[#F0FFF4] dark:bg-[#1A2E24]`
3. **Checkmark circular**: Círculo verde com ícone de check
4. **Texto em destaque**: `text-[#004225] dark:text-[#2ECC71] font-medium`

### 10.3 Regras Obrigatórias

#### Selects com valores duplicados
```javascript
// ERRADO - valores numéricos duplicados
options: [
  { value: 1, label: 'Sem choro' },
  { value: 2, label: 'Gemido' },      // DUPLICADO
  { value: 2, label: 'Choro' },       // DUPLICADO
]

// CORRETO - strings únicas + mapeamento
options: [
  { value: 'choro_1', label: 'Sem choro' },
  { value: 'choro_2a', label: 'Gemido' },
  { value: 'choro_2b', label: 'Choro' },
]
// No compute:
const pointsMap = { choro_1: 1, choro_2a: 2, choro_2b: 2 };
```

#### ParseFloat obrigatório
```javascript
// ERRADO
const peso = values.peso || 0;

// CORRETO
const peso = parseFloat(values.peso) || 0;
```

#### Sem propriedade `risk` indesejada
```javascript
// ERRADO - gera badge automático
return {
  score: volumeTotal24h,
  risk: 'alto',  // ISSO GERA BADGE AUTOMÁTICO
};

// CORRETO - sem badge
return {
  score: volumeTotal24h,
  details: {...}  // SEM propriedade risk
};
```

### 10.4 Formatação de Score

```jsx
// Em ResultDisplay - arredonda para 2 casas decimais
<span className="text-3xl font-bold">
  {typeof result.score === 'number' ? result.score.toFixed(2) : result.score}
</span>
```

### 10.5 Exemplo de Calculadora Correta

```javascript
{
  id: 'exemplo_calc',
  title: 'Exemplo Calculadora',
  subtitle: 'Descrição curta',
  icon: 'Calculator',
  status: 'active',
  inputs: [
    { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 200, step: 0.1 },
    {
      id: 'categoria',
      label: 'Categoria',
      type: 'select',
      options: [
        { value: 'cat_a', label: 'Categoria A' },  // STRING ÚNICA
        { value: 'cat_b', label: 'Categoria B' },  // STRING ÚNICA
      ],
    },
  ],
  compute: (values) => {
    // 1. SEMPRE parseFloat
    const peso = parseFloat(values.peso) || 0;

    // 2. MAPEAMENTO para selects
    const categoriaMap = { cat_a: 10, cat_b: 20 };
    const fator = categoriaMap[values.categoria] || 10;

    // 3. Validação
    if (peso <= 0) return null;

    // 4. Cálculo
    const resultado = peso * fator;

    // 5. Retorno SEM risk
    return {
      score: resultado,
      details: {
        'Peso': `${peso} kg`,
        'Fator': `${fator}`,
        'Resultado': `${resultado.toFixed(0)} unidades`,
      },
    };
  },
  resultMessage: (result) => {
    if (!result) return 'Preencha os campos';
    return `Resultado: ${result.score.toFixed(0)} unidades`;
  },
  infoBox: {
    keyPoints: [
      'Fórmula: Resultado = Peso × Fator',
      'Categoria A: fator 10',
      'Categoria B: fator 20',
    ],
    reference: 'Fonte médica aqui',
  },
}
```

### 10.6 Estrutura do InfoBox (5 Seções Visuais)

O componente InfoBox exibe informações clínicas abaixo do resultado de cada calculadora, com hierarquia visual clara:

```javascript
infoBox: {
  // 1. WARNINGS (vermelho) - Alertas críticos
  warnings: [
    'Alerta 1 - aparece em vermelho',
    'Alerta 2 - cada item em linha separada',
  ],

  // 2. DOSES (azul) - Dosagens e valores
  doses: [
    'Dose item 1 - com ícone de pílula',
    'Dose item 2 - fundo azul claro',
  ],

  // 3. KEY POINTS (colapsável) - Pontos-chave
  keyPoints: [
    'Ponto importante 1',
    'Ponto importante 2',
    'Seção colapsável com ChevronDown/Up',
  ],

  // 4. INTERPRETATION (verde) - Interpretação clínica
  interpretation: 'Texto de interpretação em verde com ícone de informação.',

  // 5. REFERENCE (cinza) - Referências bibliográficas
  reference: 'Autor et al. Journal Name. Year. | Segunda referência aqui.',
}
```

#### Hierarquia Visual

| Seção | Cor | Ícone | Comportamento |
|-------|-----|-------|---------------|
| `warnings` | Vermelho (`#DC2626` / `#EF4444`) | AlertTriangle | Sempre visível, destaque |
| `doses` | Azul (`#2563EB` / `#60A5FA`) | Pill | Sempre visível |
| `keyPoints` | Verde/Neutro | ChevronDown | Colapsável (toggle) |
| `interpretation` | Verde (`#059669` / `#10B981`) | Info | Sempre visível |
| `reference` | Cinza (`#6B7280`) | FileText | Sempre visível, discreto |

#### Regras de Formatação

```javascript
// CORRETO - usar array para warnings
infoBox: {
  warnings: [
    'Primeiro alerta importante',
    'Segundo alerta separado',
  ],
  keyPoints: [...],
  reference: '...',
}

// INCORRETO - warning como string (formato antigo)
infoBox: {
  warning: 'Texto de alerta único',  // ❌ Migrar para warnings: []
  keyPoints: [...],
}
```

#### Campos Opcionais

Todos os campos são opcionais. O InfoBox renderiza apenas as seções presentes:

```javascript
// Mínimo - apenas referência
infoBox: {
  reference: 'Fonte bibliográfica.',
}

// Parcial - warnings e keyPoints
infoBox: {
  warnings: ['Alerta importante'],
  keyPoints: ['Ponto 1', 'Ponto 2'],
  reference: 'Fonte.',
}

// Completo - todas as seções
infoBox: {
  warnings: ['...'],
  doses: ['...'],
  keyPoints: ['...'],
  interpretation: '...',
  reference: '...',
}
```

#### Migração de Dados (warning → warnings)

Em 13/01/2026, todas as calculadoras foram migradas do formato antigo para o novo:

**Antes:**
```javascript
infoBox: {
  warning: 'Texto único de alerta',
  keyPoints: [...],
}
```

**Depois:**
```javascript
infoBox: {
  warnings: ['Texto único de alerta'],
  keyPoints: [...],
}
```

**Calculadoras migradas:** Todas as 76+ calculadoras do sistema, incluindo:
- Pediatria (jejum, glasgow, steward, pews, psofa, pim3, prism3, flacc, parkland)
- Via Aérea (via_aerea, desfib, broselow)
- Hemodinâmica (cristaloide, parkland)
- UTI/Sepse (sofa, qsofa, cam_icu, apache2, cpis)
- Clínicas/Risco (chads2_vasc, has_bled, rcri, stop_bang, berlin, lis, etc.)
- Nefrologia/Eletrólitos (cockcroft, ckd_epi, hiponatremia, calcio_corrigido, etc.)
- Neurologia (glasgow, pupilas, nihss, opioides)

### 10.7 Layout da Página de Calculadoras

#### Estrutura de Arquivos

| Arquivo | Função |
|---------|--------|
| `App.jsx` | Wrapper com header fixo e padding externo (`px-4 sm:px-5 py-4`) |
| `CalculatorShowcase.jsx` | Componente principal da listagem de calculadoras |
| `SectionHeader` | Accordion expandível por categoria |
| `WidgetCard` | Card individual de cada calculadora |

#### Regras de Padding (IMPORTANTE)

O padding da página é controlado **apenas** pelo wrapper no `App.jsx`:

```jsx
// App.jsx - CalculadorasPageWrapper
<div className="px-4 sm:px-5 py-4">
  <CalculatorShowcase />
</div>
```

O `CalculatorShowcase` **NÃO deve ter padding próprio** para evitar margem duplicada:

```jsx
// CORRETO - sem padding, herda do wrapper
<div className="space-y-4 min-h-screen">

// ERRADO - causa padding duplo nas laterais
<div className="p-4 lg:p-6 space-y-6 min-h-screen bg-[#F0FFF4]">
```

#### Grid de Calculadoras

Dentro de cada seção expandida, as calculadoras são exibidas em grid de 2 colunas:

```jsx
// Grid SEM margem esquerda extra
<div className="grid grid-cols-2 gap-3 mt-3">
  {calculators.map((calc) => (
    <WidgetCard key={calc.id} ... />
  ))}
</div>
```

**Não usar `ml-2`** no grid - isso desalinha o conteúdo das laterais.

#### Hierarquia Visual

```
┌─────────────────────────────────────┐
│ Header (fixo, via Portal)           │
├─────────────────────────────────────┤
│ px-4 padding (App.jsx wrapper)      │
│ ┌─────────────────────────────────┐ │
│ │ Ícone + Título "Calculadoras"   │ │
│ │ Subtítulo: "X calculadoras"     │ │
│ ├─────────────────────────────────┤ │
│ │ 🔍 Buscar calculadora...        │ │
│ ├─────────────────────────────────┤ │
│ │ ┌─────────────────────────────┐ │ │
│ │ │ SectionHeader (Accordion)   │ │ │
│ │ │ [Ícone] Título      [N] [▼] │ │ │
│ │ └─────────────────────────────┘ │ │
│ │ ┌────────┐ ┌────────┐          │ │
│ │ │ Widget │ │ Widget │ (2 cols) │ │
│ │ │ Card   │ │ Card   │          │ │
│ │ └────────┘ └────────┘          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 11. TROUBLESHOOTING

### 11.1 Problemas Comuns

#### Props vazando para o DOM
```jsx
// ERRADO
const Card = ({ noPadding, variant, ...props }) => (
  <div {...props} noPadding={noPadding} />
)

// CORRETO
const Card = ({ noPadding, variant, className, ...props }) => {
  return (
    <div
      className={cn(base, noPadding && "p-0", className)}
      data-variant={variant}
      {...props}
    />
  )
}
```

#### Overflow vazando do container
```css
.container {
  min-width: 0;
  overflow-x: hidden;
  isolation: isolate;
}
```

#### Dark mode não aplicando
```jsx
// Verificar se ThemeProvider está no root
<ThemeProvider>
  <App />
</ThemeProvider>

// Verificar classes dark:
className="bg-white dark:bg-gray-900"
```

#### Animações travando em mobile
```jsx
// Preferir transform a position
// ERRADO: animate={{ left: 0 }}
// CORRETO: animate={{ x: 0 }}
```

### 11.2 Comandos de Debug

```bash
# Ver erros de compilação
npm run build

# Lint
npm run lint

# Dev com logs
DEBUG=* npm run dev
```

---

## 12. CHECKLIST DE VALIDAÇÃO

### 12.1 Antes de Commitar

```
[ ] npm run build passa sem erros
[ ] npm run lint passa sem erros
[ ] Testado em Light Mode
[ ] Testado em Dark Mode
[ ] Testado em mobile (320px)
[ ] Testado em tablet (768px)
[ ] Testado em desktop (1440px)
[ ] Touch targets >= 44px
[ ] Keyboard navigation funciona
[ ] Sem erros no console
```

### 12.2 Checklist por Componente

```
[ ] Props documentadas
[ ] Variantes funcionando
[ ] Estados (hover, active, focus, disabled)
[ ] Animações suaves
[ ] Responsivo
[ ] Acessível (ARIA)
[ ] Exportado no index.js
[ ] Adicionado ao Showcase
```

### 12.3 Checklist de Responsividade

```
MOBILE (< 768px):
[ ] Layout em coluna única (quando apropriado)
[ ] Touch targets 44px+
[ ] Scroll horizontal contido
[ ] Bottom sheets em vez de dropdowns
[ ] Sidebar como drawer
[ ] Fontes legíveis (min 14px)

TABLET (768-1023px):
[ ] Layout de 2 colunas
[ ] Sidebar collapsible
[ ] Dropdowns funcionando
[ ] Orientação portrait e landscape

DESKTOP (>= 1024px):
[ ] Layout completo
[ ] Sidebar expandida
[ ] Hover states
[ ] Atalhos de teclado
```

---

## 13. PÁGINAS DO APP

### 13.1 Estrutura de Páginas

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| `HomePage` | HomePage.jsx | Dashboard principal com busca inline (dropdown live) e atalhos personalizáveis (33 opções em 7 categorias) |
| `BibliotecaPage` | BibliotecaPage.jsx | Biblioteca de documentos com grid 2 colunas |
| `DocumentoDetalhePage` | DocumentoDetalhePage.jsx | Visualização de documento com versões |
| `PermissionsPage` | PermissionsPage.jsx | Centro de Gestão (8 abas) |
| `ProfilePage` | ProfilePage.jsx | Perfil do usuário com card agrupado de ações (Editar Perfil, Alterar Senha, Gerenciamento) |
| `GestaoPage` | GestaoPage.jsx | Hub de gestão com 4 widgets (Qualidade, Financeiro, Escalas, Reuniões) |
| `FaturamentoPage` | faturamento/FaturamentoPage.jsx | Módulo de faturamento médico completo (dashboard, eventos, notas, convênios) |
| `GerenciarResidenciaPage` | GerenciarResidenciaPage.jsx | Gestão de residentes e plantão (admin only) |
| `QualidadePage` | QualidadePage.jsx | Menu de qualidade |
| `DashboardExecutivoPage` | dashboard/DashboardExecutivoPage.jsx | Dashboard executivo unificado Qmentum com 11 seções: score geral, narrative, insights, autoavaliacao ROPs (DonutChart), protocolos, cobertura documental (DonutChart), KPIs com ranking/full list, incidentes, planos PDCA (DonutChart), conquistas, alertas. AdminOnly: PDF export (qualidadeReport template) + Modal Gerenciar Ciclo. BottomNav com shield ativo. KPI trend computado de dados reais (ind.meses). (v3.37) |
| `ReunioesPage` | ReunioesPage.jsx | Listagem de reuniões com criação (NovaReuniaoModal), filtro por status, reuniões passadas por tipo, ordenação data+horário (`sortByDateTime`), DS tokens |
| `ReuniaoDetalhePage` | reunioes/ReuniaoDetalhePage.jsx | Detalhes de reunião, upload ata (UploadAtaModal), upload subsídio (UploadSubsidioModal), PDF via ViewPdfModal, ações por status/data |
| `MenuPage` | MenuPage.jsx | Menu principal com widgets (Calculadoras, Manutenção) |
| `InboxPage` | communication/InboxPage.jsx | Caixa de mensagens (iOS Mail style) com 4 tabs (Todas, Mensagens, Notificações, Rastrear) |
| `MessageDetailPage` | communication/MessageDetailPage.jsx | Detalhe de mensagem/notificação com reply, archive, delete |

### 13.1.1 MenuPage - Widgets Disponíveis

| Widget | Ícone | Ação |
|--------|-------|------|
| Calculadoras | Calculator | Navega para página de calculadoras médicas |
| Manutenção | Wrench | Abre sistema externo FixCare (`https://app.fixcare.io/auth`) |

### 13.1.2 Páginas de Qualidade (6 principais + 35 sub-páginas)

**Páginas Principais:**

| Página | Arquivo | Conteúdo |
|--------|---------|----------|
| `PainelGestaoPage` | PainelGestaoPage.jsx | 21 KPIs de qualidade anestésica (dados de indicadores-2025.js) com KPIEditor para admins |
| `RelatoriosPage` | RelatoriosPage.jsx | 3 relatórios (Trimestral, Incidentes, Indicadores) |
| `ComitesPage` | ComitesPage.jsx | 9 comitês institucionais |
| `EticaBioeticaPage` | EticaBioeticaPage.jsx | 5 áreas de ética com accordions e documentos mock |
| `AuditoriasPage` | AuditoriasPage.jsx | 2 grupos (Operacionais + Conformidade) |
| `DesastresPage` | DesastresPage.jsx | 3 seções (Emergências + Planos + Siglas) |

**Indicadores de Qualidade 2025 (21 KPIs em indicadores-2025.js):**

| ID | Indicador | Meta |
|----|-----------|------|
| `consulta_pre_anestesica` | Procedimentos eletivos com consulta pré-anestésica | >= 95% |
| `dor_intraop_alta` | Dor aguda intraoperatória até alta anestésica | <= 10% |
| `jejum_abreviado` | Abreviação do jejum prolongado | >= 60% |
| `pcr_inducao_alta` | Parada cardiorrespiratória (indução-alta) | Meta zero |
| `mudanca_tecnica` | Mudança de técnica anestésica | < 5% |
| `uti_sem_planejamento` | Encaminhado a UTI sem planejamento | <= 0.3% |
| `controle_glicemico` | Efetividade do controle glicêmico | >= 90% |
| `saidas_sem_evento` | Saídas sem eventos do ato anestésico | > 90% |
| `mortalidade_48h_30d` | Mortalidade associada (48h / 30d) | Meta zero |
| `estrat_risco_asa` | Estratificação de risco anestésico (ASA) | >= 98% |
| `via_aerea_dificil_nao_ident` | VAD não identificada (intraop.) | <= 2% |
| `nvpo` | Náusea e vômito (NVPO) até alta | <= 20% |
| `intoxicacao_locais` | Efetividade - manejo de intoxicação por AL | >= 90% |
| `atb_timing` | Antibioticoprofilaxia até 60min antes da incisão | >= 95% |
| `atb_droga_correta` | Antibioticoprofilaxia - droga correta | >= 95% |
| `atb_repique` | Antibioticoprofilaxia - repique | >= 95% |
| `profilaxia_antimicrobiana` | Conformidade da profilaxia antimicrobiana | >= 95% |
| `prev_cefaleia_ppd` | Efetividade - prevenção de cefaleia PPD | >= 95% |
| `hipotermia_intraop` | Hipotermia não intencional (intraop.) | <= 5% |
| `adesao_protocolos_seguranca` | Adesão aos protocolos de segurança | >= 95% |
| `adesao_protocolos_clinicos` | Adesão aos protocolos clínico-assistenciais | >= 95% |

**Arquivos relacionados:**
- `src/data/indicadores-2025.js` - Dados dos 21 KPIs (meses Jan-Dez, com null para meses futuros)
- `src/pages/PainelGestaoPage.jsx` - Página que exibe os KPIs com KPIEditor
- `src/design-system/components/anest/kpi-data-context.jsx` - Context provider
- `src/design-system/components/anest/kpi-editor.jsx` - Editor de indicadores
- `src/design-system/components/anest/kpi-card.jsx` - Card de indicador com modal

**Sub-páginas Comitês (src/pages/comites/):**
- `RegimentoInternoPage` - Regimento Interno
- `ComiteFinanceiroPage` - Comitê Financeiro
- `ComiteGestaoPage` - Gestão de Pessoas
- `ComiteQualidadePage` - Comitê de Qualidade
- `ComiteEducacaoPage` - Educação e Residência
- `ComiteEscalasPage` - Comitê de Escalas
- `ComiteTecnologiaPage` - Tecnologia e Materiais
- `ComiteEticaCondutaPage` - Ética e Conduta
- `ComiteExecutivoPage` - Executivo de Gestão

**Sub-páginas Ética (src/pages/etica/):**
- `DilemasPage` - Dilemas Bioéticos
- `ParecerUtiPage` - Parecer Ético UTI
- `DiretrizesPage` - Diretrizes Institucionais
- `EmissaoParecerPage` - Emissão de Parecer
- `CodigoEticaPage` - Código de Ética

**Sistema de Documentos de Ética:**
Todas as 5 páginas de ética possuem gestão completa de documentos PDF:
- Upload de documentos (admin only) via `UploadDocumentoModal`
- Visualização inline do PDF diretamente na página via `PDFViewer`
- Metadados do documento (título, data, autor, tamanho)
- Exclusão com confirmação (admin only)
- Empty state quando não há documento

**Arquivos de suporte:**
- `src/data/eticaConfig.js` - Configuração das 5 categorias (collection, storagePath, ícone)
- `src/hooks/useEticaDocumentos.js` - Hook com `loadDocumento`, `uploadDocumento`, `deleteDocumento`
- `src/components/etica/UploadDocumentoModal.jsx` - Modal de upload com título e observações
- `src/components/etica/index.js` - Exports dos componentes

**Coleções Firestore:**
- `etica_dilemas_documentos` - Dilemas Bioéticos
- `etica_parecer_uti_documentos` - Parecer UTI
- `etica_diretrizes_documentos` - Diretrizes
- `etica_parecer_tecnico_documentos` - Emissão de Parecer
- `etica_codigo_documentos` - Código de Ética

**Sub-páginas Auditorias (src/pages/auditorias/):**
- `HigieneMaosPage` - Higiene das Mãos
- `UsoMedicamentosPage` - Uso de Medicamentos
- `AbreviaturasPage` - Abreviaturas Perigosas
- `AuditoriasOperacionaisPage` - Auditorias Operacionais
- `AuditoriasConformidadePage` - Conformidade e Políticas

**Sub-páginas Relatórios (src/pages/relatorios/):**
- `RelatorioTrimestralPage` - Relatório Trimestral
- `RelatorioIncidentesPage` - Consolidado de Incidentes
- `RelatorioIndicadoresPage` - Indicadores de Qualidade

**Sub-páginas Desastres (src/pages/desastres/):**
- Emergências (6): `EmergenciaIncendioPage`, `EmergenciaVitimasPage`, `EmergenciaPanePage`, `EmergenciaQuimicoPage`, `EmergenciaInundacaoPage`, `EmergenciaBombaPage`
- Planos (4): `PlanoManualPage`, `PlanoTimesPage`, `PlanoApoioPage`, `PlanoSimuladoPage`

**Seção Siglas (DesastresPage.jsx):**
Widget com 10 siglas e seus significados relacionados ao gerenciamento de desastres:
- CGPED - Comitê de Gerenciamento de Preparação para Emergências e Desastres
- SESMT - Serviço Especializado em Engenharia de Segurança e em Medicina do Trabalho
- CCIH - Comissão de Controle de Infecção Hospitalar
- CC - Centro Cirúrgico
- UTI - Unidade de Terapia Intensiva
- SRPA - Sala de Recuperação Pós-Anestésica
- SAMU - Serviço de Atendimento Móvel de Urgência
- EPIs - Equipamentos de Proteção Individual
- TI - Tecnologia da Informação
- PCR - Parada Cardiorrespiratória

**Páginas de Incidentes (src/pages/incidents/):**
- `IncidentesPage` - Página principal de Gestão de Incidentes com 5 widgets:
  - Relatar Notificação - Formulário de notificação de eventos
  - Fazer Denúncia - Canal seguro e confidencial
  - Meus Relatos - Acompanhamento de registros
  - Gerar QR Code - Acesso rápido ao formulário
  - Notificação Unimed - Link externo para Sistema Epimed Monitor (https://patientsafety.epimedmonitor.com)
- `NovoIncidentePage` - Formulário 4 steps para nova notificação (LGPD: checkbox consentimento, userId condicional)
- `NovaDenunciaPage` - Canal confidencial para denúncias (LGPD: checkbox consentimento, userId condicional, gênero condicional)
- `MeusRelatosPage` - Listagem de relatos do usuário (banner sobre relatos anônimos)
- `QRCodeGeneratorPage` - Gerador de QR Codes
- `AcompanhamentoIncidentePage` - Acompanhamento de incidente
- `AcompanhamentoDenunciaPage` - Acompanhamento de denúncia
- `RastrearRelatoPage` - Rastreio por código
- `IncidenteDetalhePage` - Detalhes do incidente (validação de ownership LGPD)
- `DenunciaDetalhePage` - Detalhes da denúncia (validação de ownership LGPD)
- `IncidenteGestaoPage` - Gestão interna (Comitê)
- `DenunciaGestaoPage` - Gestão interna (Comitê)
- `PrivacyPolicyModal` - Modal com Política de Privacidade LGPD completa (11 seções)

**Módulo de Faturamento (src/pages/faturamento/):**

Sistema completo de faturamento médico com gestão de eventos CBHPM, notas fiscais e convênios.

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| `FaturamentoPage` | FaturamentoPage.jsx | Página principal com navegação para sub-módulos |
| `FaturamentoDashboardPage` | FaturamentoDashboardPage.jsx | Dashboard com métricas financeiras e gráficos |
| `EventosPage` | EventosPage.jsx | Listagem de eventos com filtros e status |
| `NovoEventoPage` | NovoEventoPage.jsx | Formulário para criar novo evento CBHPM |
| `EventoDetalhePage` | EventoDetalhePage.jsx | Detalhe do evento com status, paciente, procedimento e ações |
| `NotasPage` | NotasPage.jsx | Listagem de notas fiscais com filtros |
| `NovaNotaPage` | NovaNotaPage.jsx | Formulário de nova nota com seleção de eventos e cálculo automático |
| `NotaDetalhePage` | NotaDetalhePage.jsx | Detalhe da nota com eventos vinculados e resumo financeiro |
| `ConveniosPage` | ConveniosPage.jsx | Cadastro e gestão de convênios médicos |

**Contexto e Hooks:**
- `FaturamentoProvider` (`src/contexts/FaturamentoContext.jsx`) - Context wrapper obrigatório para todas as páginas
- `useEventos()` - Hook para listagem/filtros de eventos
- `useEvento(eventoId)` - Hook para detalhe de evento individual
- `useNotas()` - Hook para listagem/filtros de notas com `createNota()`
- `useCadastros()` - Hook para opções de convênios (`convenioOptions`)
- `formatarMoeda()` (`src/data/cbhpmData.js`) - Formatação monetária BR
- `STATUS_EVENTO`, `STATUS_NOTA` - Constantes de status com cores e labels

**Exports com alias em `pages/index.js`:**
```javascript
EventosPage as FaturamentoEventosPage,
NovoEventoPage as FaturamentoNovoEventoPage,
EventoDetalhePage as FaturamentoEventoDetalhePage,
NotasPage as FaturamentoNotasPage,
NovaNotaPage as FaturamentoNovaNotaPage,
NotaDetalhePage as FaturamentoNotaDetalhePage,
ConveniosPage as FaturamentoConveniosPage,
```

**Aliases de Navegação no App.jsx:**

Algumas páginas possuem case aliases adicionais para suportar chamadas `onNavigate()` com nomes alternativos:

| Alias | Redireciona para | Usado por |
|-------|-----------------|-----------|
| `menu` | `MenuPage` | OrganogramaPage |
| `residencia` | `GerenciarResidenciaPage` | EducacaoPage |
| `incidenteGestao` | `IncidenteGestaoPage` | PermissionsPage |
| `denunciaGestao` | `DenunciaGestaoPage` | PermissionsPage |

**Páginas ROPs - Desafio das ROPs (src/pages/rops/):**

Sistema gamificado de quiz sobre as 32 Práticas Organizacionais Obrigatórias (ROPs) do Qmentum.

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| `ROPsDesafioPage` | ROPsDesafioPage.jsx | Menu principal com 6 macro áreas + card de Ranking |
| `ROPsChoiceMenuPage` | ROPsChoiceMenuPage.jsx | Escolha entre Questões ou Podcasts |
| `ROPsSubdivisoesPage` | ROPsSubdivisoesPage.jsx | Lista de ROPs de uma área com cards uniformes |
| `ROPsQuizPage` | ROPsQuizPage.jsx | Quiz usando componente Quiz do DS |
| `ROPsPodcastsPage` | ROPsPodcastsPage.jsx | Player de podcasts usando AudioPlayer do DS |
| `ROPsRankingPage` | ROPsRankingPage.jsx | Ranking usando Leaderboard do DS |

**Estrutura de Navegação ROPs:**
```
EducacaoPage
  └── "Desafio ROPs" → ropsDesafio

ROPsDesafioPage (ropsDesafio)
  ├── Card Área → ropsChoiceMenu (com areaKey)
  └── Card Ranking → ropsRanking

ROPsChoiceMenuPage (ropsChoiceMenu)
  ├── Questões → ropsSubdivisoes (com areaKey)
  └── Podcasts → ropsPodcasts (com areaKey)

ROPsSubdivisoesPage (ropsSubdivisoes)
  └── Card ROP → ropsQuiz (com areaKey, ropKey)

ROPsQuizPage (ropsQuiz)
  └── Resultado → Voltar ou Ranking

ROPsPodcastsPage (ropsPodcasts)
  └── AudioPlayer para cada podcast

ROPsRankingPage (ropsRanking)
  └── Leaderboard com pontuação
```

**6 Macro Áreas (32 ROPs, 640 questões):**

| Área | Ícone | Cor | ROPs |
|------|-------|-----|------|
| Cultura de Segurança | Shield | #9C27B0 (roxo) | 5 |
| Comunicação | MessageSquare | #10b981 (verde) | 5 |
| Uso de Medicamentos | Pill | #3B82F6 (azul) | 5 |
| Vida Profissional | Users | #F59E0B (amarelo) | 6 |
| Prevenção de Infecções | Sparkles | #EC4899 (rosa) | 5 |
| Avaliação de Riscos | AlertTriangle | #EF4444 (vermelho) | 6 |

**Arquivos de Dados:**
- `src/data/rops-data.js` - 640 questões (20 por ROP)
- `src/data/podcasts-data.js` - Áudios por área (Firebase Storage URLs)

**Componentes do DS utilizados:**
- `Quiz` - Interface completa de quiz com progresso e explicações
- `AudioPlayer` (variant="card") - Player de podcasts com skip buttons
- `Leaderboard` - Ranking de usuários
- `WidgetCard` - Cards das macro áreas
- `Badge` - Contadores de questões/podcasts

**Padrões de UI:**
- Cards uniformes com `min-h-[88px]` e `flex items-center`
- Card de destaque no topo com gradiente da cor da área
- Títulos com `line-clamp-2` para truncamento consistente
- Badge numérico `w-12 h-12` para cada ROP

### 13.2 Navegação

A navegação é controlada via duas props:
- `onNavigate(screen, params)` - Navegar para uma página específica
- `goBack()` - Voltar para a página anterior (usa histórico de navegação)

```jsx
// Navegar para biblioteca
onNavigate('biblioteca');

// Navegar para documento com ID
onNavigate('documento', { documentoId: 'doc123' });

// Voltar para página anterior (usa histórico)
goBack();

// Props típicas de uma página
function MinhaPage({ onNavigate, goBack, params }) {
  return (
    <button onClick={goBack}>
      <ChevronLeft /> Voltar
    </button>
  );
}
```

**Ver Seção 20.6** para implementação completa do sistema de histórico de navegação.

**Mapeamento activeNav (BottomNav) - Resumo:**

| Nav Tab | Páginas |
|---------|---------|
| `home` | home, profile, pendencias, comunicados |
| `shield` | gestao, qualidade, financeiro, escalas, reunioes, painelGestao, organograma, eticaBioetica, comites, gestaoDocumental, auditorias, relatorios, desastres, incidentes, novoIncidente, novaDenuncia, meusRelatos, qrCodeGenerator, acompanhamentoIncidente, acompanhamentoDenuncia, incidenteDetalhe, denunciaDetalhe, rastrearRelato, incidenteGestao, denunciaGestao, biblioteca, documento, faturamento, faturamentoDashboard, faturamentoEventos, faturamentoNovoEvento, faturamentoEventoDetalhe, faturamentoNotas, faturamentoNovaNota, faturamentoNotaDetalhe, faturamentoConvenios, auditoriasInterativas, novaAuditoria, execucaoAuditoria, auditoriaResultado, autoavaliacao, autoavaliacaoArea, autoavaliacaoRop, autoavaliacaoRelatorio, planosAcao, planoAcaoDetalhe, kpi* (6), etica* (5), auditorias* (8), emergencia* (6), plano* (4), relatorio* (4) |
| `education` | educacao, educacaoContinuada, trilhaDetalhe, cursoDetalhe, certificados, pontos, aulaPlayer, admin*, ropsDesafio, ropsChoiceMenu, ropsSubdivisoes, ropsQuiz, ropsPodcasts, ropsRanking |
| `menu` | menuPage, calculadoras, personalizarAtalhos, gerenciarResidencia, centroGestao |

### 13.3 BibliotecaPage - Grid de Documentos

**Layout:**
- Grid 2 colunas (`grid-cols-2 gap-3`)
- Cards compactos com DocumentoCard
- Filtros por tipo via TipoTabs
- Barra de busca no topo

**Filtros de Tipo:**
```jsx
const tipos = [
  'todos', 'protocolo', 'politica', 'formulario',
  'manual', 'relatorio', 'processo', 'termo', 'risco', 'plano'
];
```

### 13.4 DocumentoDetalhePage - Detalhes do Documento

**Recursos:**
- Visualizador de PDF integrado
- Sistema de versões com histórico
- Ferramentas de administrador (engrenagem)
- Download de PDF
- Navegação por abas (Resumo, Conteúdo, Notas)

**Props:**
```jsx
<DocumentoDetalhePage
  documentoId={id}
  onNavigate={handleNavigate}
  isAdmin={true}  // Habilita ferramentas de admin
/>
```

### 13.5 GerenciarResidenciaPage - Gestão de Residentes (v3.12.0)

**Acesso:** Apenas admins (via ProfilePage ou navegação direta)

**Funcionalidades:**
- Listar residentes em tabela editável
- Editar dados de residentes (nome, ano R1/R2/R3, estágio, cirurgião)
- Adicionar novo residente
- Excluir residente (com confirmação)
- Gerenciar plantão da residência

**Arquitetura:**
```
GerenciarResidenciaPage.jsx
  ├── useResidencia (hook)
  │     ├── residentes (array de residentes)
  │     ├── plantao (dados do plantão atual)
  │     ├── saveEstagios() → Firestore
  │     ├── savePlantao() → Firestore
  │     └── canEdit (verificação de permissão)
  │
  └── residenciaService.js
        ├── getEstagios() → collection: residencia/estagios
        ├── updateEstagios()
        ├── getPlantao() → collection: residencia/plantao
        └── updatePlantao()
```

**Estrutura de Dados (Firestore):**
```javascript
// Collection: residencia/estagios
{
  residentes: [
    { id: "r1-1", nome: "Ana Costa", ano: "R1", estagio: "UTI Adulto", cirurgiao: "Dr. Silva" },
    // ... mais residentes
  ],
  updatedAt: timestamp,
  updatedBy: "userId"
}

// Collection: residencia/plantao
{
  residente: "Pedro Alves",
  ano: "R2",
  data: "Quarta, 15 Jan",
  hora: "19:00",
  updatedAt: timestamp,
  updatedBy: "userId"
}
```

**Componentes de UI:**
- `SectionCard` - Cards para residentes e plantão
- `ResidenteAno` - Badge colorido por ano (R1=azul, R2=laranja, R3=verde)
- `Modal` - Edição de plantão
- Botões: Adicionar (+), Editar (Pencil), Excluir (Trash2)

---

## 14. SISTEMA DE GESTÃO DOCUMENTAL

### 14.1 Visão Geral

Sistema de gestão documental implementado em **três locais**:
- **A**: BibliotecaPage - Biblioteca de documentos com accordions por tipo
- **B**: RelatoriosPage - Relatórios com design unificado (accordions)
- **C**: PermissionsPage - Aba "Docs" e sub-tab "Relatórios" para gestão centralizada
- **D**: DocumentoDetalhePage - Página unificada para visualização de documentos E relatórios

### 14.1.1 Design Unificado (v3.15.2)

BibliotecaPage e RelatoriosPage compartilham o mesmo design:

```
┌─────────────────────────────────────────────────────┐
│ [Stats Grid 3 colunas - apenas Relatórios]          │
├─────────────────────────────────────────────────────┤
│ [Ícone] Título                                      │
│         X documentos                                │
├─────────────────────────────────────────────────────┤
│ [SearchBar: Buscar documentos...]                   │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐   │
│ │ [📄] Protocolos                    17  ▼      │   │ ← SectionHeader
│ └───────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────┐   │
│ │ [⚖️] Políticas                      2  ▲      │   │ ← Expandido
│ ├───────────────────────────────────────────────┤   │
│ │ ┌──────────┐ ┌──────────┐                     │   │
│ │ │ Doc 1    │ │ Doc 2    │                     │   │ ← Grid 2 cols
│ │ └──────────┘ └──────────┘                     │   │   DocumentoCard
│ └───────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ [InfoFooter: Notas informativas]                    │
└─────────────────────────────────────────────────────┘
```

### 14.1.2 Navegação Unificada (v3.15.2)

**DocumentoDetalhePage** agora busca em AMBAS as fontes de dados:

```javascript
// Fluxo de busca unificado
useEffect(() => {
  const loadDocumento = async () => {
    // 1. Buscar primeiro em mockDocumentos (biblioteca)
    const docBiblioteca = getDocumentoById(documentoId);
    if (docBiblioteca) {
      setDocumento(docBiblioteca);
      return;
    }

    // 2. Se não encontrar, buscar em mockRelatorios
    const docRelatorio = await getRelatorioById(documentoId);
    if (docRelatorio) {
      // Adaptar campos para formato esperado
      setDocumento({
        ...docRelatorio,
        setorNome: docRelatorio.responsavel || 'Qualidade',
        setorId: 'qualidade',
      });
    }
  };
  loadDocumento();
}, [documentoId]);
```

**Navegação padronizada:**
```javascript
// BibliotecaPage
onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'biblioteca' });

// RelatoriosPage
onNavigate('documento-detalhe', { documentoId: relatorio.id, returnTo: 'relatorios' });

// PermissionsPage (sub-tab Relatórios)
onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'permissions' });
```

### 14.2 Parte A: Gestão Contextual (DocumentoDetalhePage)

**Acesso:** Ícone engrenagem no header (visível apenas para admins)

**Menu de Administrador:**
```jsx
// Opções do menu
const adminOptions = [
  { icon: Edit, label: 'Editar informações', action: handleEdit },
  { icon: Upload, label: 'Upload PDF', action: handleUpload },
  { icon: Plus, label: 'Nova versão', action: handleNewVersion },
  { icon: Trash2, label: 'Excluir documento', action: handleDelete },
];
```

**Implementação:**
```jsx
<PageHeader
  title={documento.titulo}
  onBack={() => onNavigate('biblioteca')}
  rightContent={
    isAdmin && (
      <button onClick={() => setShowAdminMenu(!showAdminMenu)}>
        <Settings className="w-5 h-5 text-[#006837] dark:text-[#2ECC71]" />
      </button>
    )
  }
/>
```

### 14.3 Parte B: Gestão Centralizada (PermissionsPage)

**Acesso:** Centro de Gestão > Aba "Docs"

**Grid de 4 Abas:**
```jsx
const TABS = [
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'documentos', label: 'Docs', icon: FileText },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];
```

**Funcionalidades:**
- Busca por título/código
- Lista de todos os documentos ativos
- Botões Editar e Excluir por documento
- Badge de tipo com cor

### 14.4 Cores de Tipo de Documento

```javascript
// TIPO_CONFIG - Biblioteca de Documentos
const TIPO_CONFIG = {
  protocolo: { label: 'Protocolos', icon: FileText, color: '#059669', order: 1 },
  politica: { label: 'Políticas', icon: BookOpen, color: '#6366F1', order: 2 },
  formulario: { label: 'Formulários', icon: ClipboardList, color: '#F59E0B', order: 3 },
  manual: { label: 'Manuais', icon: BookOpen, color: '#EC4899', order: 4 },
  relatorio: { label: 'Relatórios', icon: FileBarChart, color: '#3B82F6', order: 5 },
  processo: { label: 'Processos', icon: GitBranch, color: '#8B5CF6', order: 6 },
  termo: { label: 'Termos', icon: FileSignature, color: '#14B8A6', order: 7 },
  risco: { label: 'Riscos', icon: AlertTriangle, color: '#DC2626', order: 8 },
  plano: { label: 'Planos', icon: Target, color: '#0891B2', order: 9 },
};
```

### 14.4.1 Configuração de Tipos de Relatórios (v3.15.2)

```javascript
// RELATORIO_TIPO_CONFIG - Página de Relatórios
// Arquivo: src/data/relatoriosConfig.js
export const RELATORIO_TIPO_CONFIG = {
  trimestral: {
    label: 'Relatório Trimestral',
    shortLabel: 'Trimestral',
    icon: FileBarChart,
    color: '#3B82F6',  // Azul
    order: 1,
  },
  incidentes: {
    label: 'Consolidado de Incidentes',
    shortLabel: 'Incidentes',
    icon: AlertTriangle,
    color: '#DC2626',  // Vermelho
    order: 2,
  },
  indicadores: {
    label: 'Indicadores de Qualidade',
    shortLabel: 'Indicadores',
    icon: TrendingUp,
    color: '#059669',  // Verde
    order: 3,
  },
};
```

### 14.5 Sistema de Versionamento

**Estrutura de Versão:**
```javascript
{
  numero: '2.1',
  data: '2025-01-10',
  descricao: 'Atualização de procedimentos',
  autor: 'Dr. Silva',
  arquivoUrl: '/path/to/v2.1.pdf'
}
```

**Modal de Histórico:**
- Container: `max-h-[90vh] flex flex-col`
- Área de conteúdo: `overflow-y-auto flex-1`
- Lista de versões com data e autor
- Sem botão de download individual (removido)

---

## 15. SISTEMA DE PERMISSÕES

### 15.1 Centro de Gestão (PermissionsPage)

**Acesso:** Avatar no header > "Gerenciar Usuários"

**Estrutura de 9 Abas (NAVIGATION_ITEMS em ManagementLayout.jsx):**
1. **Usuarios** - Gerenciamento de usuários e roles
2. **Emails** - Configuração de emails autorizados
3. **Documentos** - Gestão centralizada de documentos (sub-items: Etica, Comites, Auditorias, Relatorios, Biblioteca, Financeiro)
4. **Estatisticas** - Estatísticas e métricas de uso
5. **Comunicados** - Painel de monitoramento de comunicados Qmentum (3 tabs: Visao Geral, Conformidade, Acoes)
6. **Incidentes** - Gestão de responsáveis e painel de ética
7. **Residencia** - Gestão de residentes médicos

### 15.2 Aba Usuários

**Funcionalidades:**
- Lista de usuários com avatar, nome, email, role
- Busca por nome/email
- Filtro por role
- Botão editar para cada usuário
- Modal de edição de permissões

### 15.3 Aba Emails

**Funcionalidades:**
- Lista de emails autorizados
- Adicionar novo email
- Remover email da lista
- Domínio automático (@anest.com.br)

### 15.4 Aba Auditorias

**Sub-tabs:**
- Documentos (lista principal)
- Categorias (tipos de auditorias)
- Revisões (vencidas e próximas)
- Arquivados
- Relatórios
- Stats

### 15.5 Aba Comitês (v3.16.0)

**Arquivo:** `src/pages/PermissionsPage.jsx`

**Dados:** `src/data/mockComites.js` (27 documentos mock)

**Configuração:** `src/data/comitesConfig.js` (9 tipos de comitês)

**Sub-tabs:**
- **Documentos** - Lista principal com busca e filtro por tipo
- **Categorias** - Grid de 9 tipos de comitês com contagem
- **Arquivados** - Documentos arquivados com botão restaurar
- **Stats** - Estatísticas e gráficos

**Tipos de Comitês (COMITE_TIPO_CONFIG):**

| Tipo | Label | Ícone | Cor |
|------|-------|-------|-----|
| `regimento_interno` | Regimento Interno | FileText | #2563eb |
| `executivo` | Executivo de Gestão | Briefcase | #059669 |
| `financeiro` | Comitê Financeiro | DollarSign | #059669 |
| `gestao_pessoas` | Gestão de Pessoas | Users | #7c3aed |
| `escalas` | Comitê de Escalas | Calendar | #f59e0b |
| `tecnologia` | Tecnologia e Materiais | Cpu | #2563eb |
| `qualidade` | Comitê de Qualidade | Shield | #2563eb |
| `educacao` | Educação e Residência | BookOpen | #dc2626 |
| `etica_conduta` | Ética e Conduta | Scale | #7c3aed |

**Componente ComiteDocCard:**
Card de documento idêntico ao `DocCardWithMenu`:
- Badge com ícone pequeno (3x3) + label do tipo
- Código ao lado do badge
- Título truncado
- Metadados (versão, autor, data)
- Tags (até 3)
- Menu de 3 pontos (MoreVertical) com dropdown:
  - Ver Detalhes
  - Histórico

**Estados:**
```javascript
const [comitesSubTab, setComitesSubTab] = useState('documentos');
const [comitesSearchQuery, setComitesSearchQuery] = useState('');
const [comitesFilterTipo, setComitesFilterTipo] = useState('todos');
```

**Memos:**
```javascript
const filteredComites = useMemo(() => { ... }, [comitesFilterTipo, comitesSearchQuery]);
const comitesStats = useMemo(() => { ... }, []);
```

### 15.6 Aba Stats

**Métricas Disponíveis:**
- Total de usuários
- Usuários ativos (último mês)
- Documentos na biblioteca
- ROPs completados

### 15.7 Aba Incidentes

**Sub-tabs:**
- **Responsáveis** - Configuração de responsáveis por notificações
- **Painel de Ética** - Dashboard de incidentes e denúncias

**Dropdown dinâmico (v3.42.0):** O Select "Responsável pela Análise" nas páginas de gestão (`IncidenteGestaoPage`, `DenunciaGestaoPage`) usa `incidentResponsibles` do `UsersManagementContext` em vez da lista hardcoded `MEMBROS_COMITE`. Fallback para `MEMBROS_COMITE` se lista vazia.

### 15.8 Aba Residência

**Funcionalidades:**
- Lista de residentes (R1, R2, R3)
- Edição de estágios
- Visualização de plantões

### 15.9 Modal de Edição de Permissões (SIMPLIFICADO v3.20.0)

**IMPORTANTE - Sistema Simplificado:**
- **Administrador** = Acesso total + CRUD automático em tudo que tem acesso
- **Permissões por seção** = Apenas para **acesso/visualização**
- **Cada card tem apenas 1 toggle de acesso** (não mais permissões individuais Criar/Editar/Excluir)

**Lógica de Permissões:**

| Toggle | Efeito |
|--------|--------|
| **Card habilitado** | Usuário pode **visualizar** a funcionalidade |
| **Administrador** | Usuário pode **criar/editar/excluir** em todas as funcionalidades que tem acesso |

**Estrutura Visual Simplificada:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Perfil do Usuário: Dropdown]                              │
├─────────────────────────────────────────────────────────────┤
│  📍 Permissões por Seção                                    │
│                                                             │
│  [v] HOME ─────────────────────────────────────────────────│
│      [Comunicados] ──────────────────── [ON/OFF]           │
│      [Pendências] ───────────────────── [ON/OFF]           │
│      [Perfil] ───────────────────────── [ON/OFF]           │
│      [Atalhos Personalizados] ───────── [ON/OFF]           │
│      [Plantão do Dia] ───────────────── [ON/OFF]           │
│      [Férias] ───────────────────────── [ON/OFF]           │
│      [Estágios Residência] ──────────── [ON/OFF]           │
│      [Plantão Residência] ───────────── [ON/OFF]           │
│                                                             │
│  [>] GESTÃO (22 cards) ────────────────────────────────────│
│  [>] DASHBOARD (1 card) ──────────────────────────────────│
│  [>] EDUCAÇÃO (3 cards) ───────────────────────────────────│
│  [>] MENU (2 cards) ───────────────────────────────────────│
│                                                             │
│  ⚙️ Configurações Especiais                                 │
│                                                             │
│  [Administrador] ─────── [ON/OFF]                          │
│    "Acesso total - pode criar, editar e excluir qualquer   │
│     item"                                                   │
├─────────────────────────────────────────────────────────────┤
│  [Cancelar]                    [Salvar]                     │
└─────────────────────────────────────────────────────────────┘
```

**Seções do NAV_STRUCTURE (v3.21.0 — 5 seções, 38 cards):**

| Seção | Ícone | Cards |
|-------|-------|-------|
| **HOME** (10) | Home | Comunicados, Pendências, Perfil, Atalhos Personalizados, Plantão do Dia, Férias, Estágios Residência, Plantão Residência, **Escala de Funcionários**, **Inbox / Mensagens** |
| **GESTÃO** (22) | Shield | Gestão de Incidentes, Relatar Notificação, Fazer Denúncia, Meus Relatos, Notificação Unimed, Gerar QR Code, Biblioteca de Documentos, Qualidade, Painel de Gestão, **Planos de Ação**, Auditorias, **Auditorias Interativas**, **Autoavaliação Qmentum**, Relatórios, Organograma, Ética e Bioética, Comitês, Desastres, **Gestão Documental**, Faturamento, Escalas, Reuniões |
| **DASHBOARD** (1) | BarChart3 | **Dashboard Executivo** |
| **EDUCAÇÃO** (3) | GraduationCap | Educação Continuada, Desafio ROPs, Residência Médica |
| **MENU** (2) | Menu | Calculadoras, Manutenção |

**Arquivo:** `src/pages/management/components/PermissionsModal.jsx`

**Estrutura de Dados Simplificada:**
```javascript
const NAV_STRUCTURE = {
  home: {
    label: 'Home',
    icon: Home,
    cards: [
      { id: 'comunicados', label: 'Comunicados', icon: MessageSquare },
      { id: 'pendencias', label: 'Pendências', icon: Bell },
      // ... apenas id, label, icon - SEM array de permissions
    ],
  },
  gestao: { ... },
  dashboard: { ... },
  educacao: { ... },
  menu: { ... },
};
```

**PermissionCard Simplificado:**
```jsx
function PermissionCard({ card, enabled, onToggle }) {
  const Icon = card.icon;
  return (
    <div className={`rounded-xl border transition-colors ${
      enabled ? 'bg-[#F0FFF4] border-[#2ECC71]/30' : 'bg-[#F3F4F6] border-[#E5E7EB]'
    }`}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">{card.label}</span>
        </div>
        <Switch checked={enabled} onChange={onToggle} size="sm" />
      </div>
    </div>
  );
}
```

**Características do Modal:**
- Altura máxima: `max-h-[85vh]`
- Cards com apenas toggle de acesso (sem sub-permissões)
- Administrador = CRUD automático em tudo
- Estado simplificado: `cardPermissions` + `isAdmin`

---

## 16. COMPONENTES DE PÁGINA

### 16.1 Header Fixo (Padrão Inline com createPortal)

**IMPORTANTE:** O header é implementado **diretamente em cada página** usando `createPortal` para garantir posicionamento fixo correto. Não existe mais um componente centralizado `PageHeader`.

**Por que usar createPortal?**
O `position: fixed` pode ser quebrado por containers pai com `transform`, `filter`, `will-change` ou `overflow: hidden`. Usando `createPortal`, o header é renderizado diretamente no `document.body`, fora de qualquer container que possa afetar o posicionamento fixo.

**Padrão de Implementação:**
```jsx
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';

function MinhaPage({ onNavigate }) {
  // Header inline antes do return
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('paginaAnterior')}
              className="flex items-center gap-1 text-primary-hover dark:text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-primary dark:text-foreground truncate text-center flex-1 mx-2">
            Título da Página
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header via Portal - OBRIGATÓRIO */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para compensar header fixo - OBRIGATÓRIO */}
      <div className="h-14" aria-hidden="true" />

      {/* Conteúdo da página */}
      <div className="px-4 sm:px-5">
        {/* ... */}
      </div>
    </div>
  );
}
```

**Cores do Design System (Header) — usar tokens semânticos:**

| Elemento | Token | Resolve Light | Resolve Dark |
|----------|-------|---------------|--------------|
| Background | `bg-card` | `#FFFFFF` | `#1A2420` |
| Texto título | `text-primary dark:text-foreground` | `#004225` | `#FFFFFF` |
| Botão voltar | `text-primary-hover dark:text-primary` | `#006837` | `#2ECC71` |
| Borda | `border-border` | `#C8E6C9` | `#2A3F36` |

**Páginas que usam este padrão (64 páginas):**

**Páginas de Incidentes (12):**
- `NovaDenunciaPage.jsx` - título: "Nova Denúncia"
- `NovoIncidentePage.jsx` - título: "Nova Notificação"
- `IncidentesPage.jsx` - título: "Gestão de Incidentes"
- `MeusRelatosPage.jsx` - título: "Meus Relatos"
- `QRCodeGeneratorPage.jsx` - título: "Gerador de QR Code"
- `AcompanhamentoDenunciaPage.jsx` - título dinâmico
- `AcompanhamentoIncidentePage.jsx` - título dinâmico
- `RastrearRelatoPage.jsx` - título: "Rastrear Relato"
- `IncidenteDetalhePage.jsx` - título: "Detalhe do Incidente"
- `DenunciaDetalhePage.jsx` - título: "Detalhe da Denúncia"
- `IncidenteGestaoPage.jsx` - título: "Gestão do Incidente"
- `DenunciaGestaoPage.jsx` - título: "Gestão da Denúncia"

**Páginas Gerais (17):**
- `PermissionsPage.jsx` - título: "Centro de Gestão"
- `BibliotecaPage.jsx` - título: "Biblioteca"
- `DocumentoDetalhePage.jsx` - título dinâmico
- `PersonalizarAtalhosPage.jsx` - título: "Personalizar Atalhos"
- `ComunicadosPage.jsx` - título: "Comunicados"
- `PendenciasPage.jsx` - título: "Minhas Pendências"
- `ProfilePage.jsx` - título: "Meu Perfil"
- `DesastresPage.jsx` - título: "Desastres"
- `RelatoriosPage.jsx` - título: "Relatórios"
- `AuditoriasPage.jsx` - título: "Auditorias"
- `ComitesPage.jsx` - título: "Comitês"
- `EticaBioeticaPage.jsx` - título: "Ética e Bioética"
- `OrganogramaPage.jsx` - título: "Organograma"
- `PainelGestaoPage.jsx` - título: "Painel de Gestão"
- `EscalasPage.jsx` - título: "Escalas"
- `FinanceiroPage.jsx` - título: "Financeiro"
- `ReunioesPage.jsx` - título: "Reuniões" (funcional: listagem, criação, detalhes, upload ata/subsídio, DS tokens completos)
- `QualidadePage.jsx` - título: "Qualidade"

**Sub-páginas de KPI (6):**
- `KpiInfeccaoPage.jsx` - título: "Infecção"
- `KpiAdesaoPage.jsx` - título: "Adesão"
- `KpiEventosPage.jsx` - título: "Eventos"
- `KpiSatisfacaoPage.jsx` - título: "Satisfação"
- `KpiTempoPage.jsx` - título: "Tempo"
- `KpiMedicamentosPage.jsx` - título: "Medicamentos"

**Sub-páginas de Comitês (9):**
- `RegimentoInternoPage.jsx` - título: "Regimento Interno"
- `ComiteFinanceiroPage.jsx` - título: "Comitê Financeiro"
- `ComiteGestaoPage.jsx` - título: "Comitê de Gestão"
- `ComiteQualidadePage.jsx` - título: "Comitê de Qualidade"
- `ComiteEducacaoPage.jsx` - título: "Comitê de Educação"
- `ComiteEscalasPage.jsx` - título: "Comitê de Escalas"
- `ComiteTecnologiaPage.jsx` - título: "Comitê de Tecnologia"
- `ComiteEticaCondutaPage.jsx` - título: "Comitê de Ética e Conduta"
- `ComiteExecutivoPage.jsx` - título: "Comitê Executivo"

**Sub-páginas de Ética (5):**
- `DilemasPage.jsx` - título: "Dilemas Éticos"
- `ParecerUtiPage.jsx` - título: "Parecer UTI"
- `DiretrizesPage.jsx` - título: "Diretrizes"
- `EmissaoParecerPage.jsx` - título: "Emissão de Parecer"
- `CodigoEticaPage.jsx` - título: "Código de Ética"

**Sub-páginas de Auditorias (5):**
- `HigieneMaosPage.jsx` - título: "Higiene das Mãos"
- `UsoMedicamentosPage.jsx` - título: "Uso de Medicamentos"
- `AbreviaturasPage.jsx` - título: "Abreviaturas"
- `AuditoriasOperacionaisPage.jsx` - título: "Auditorias Operacionais"
- `AuditoriasConformidadePage.jsx` - título: "Auditorias de Conformidade"

**Sub-páginas de Relatórios (3):**
- `RelatorioTrimestralPage.jsx` - título: "Relatório Trimestral"
- `RelatorioIncidentesPage.jsx` - título: "Relatório de Incidentes"
- `RelatorioIndicadoresPage.jsx` - título: "Relatório de Indicadores"

**Sub-páginas de Desastres (10):**
- `EmergenciaIncendioPage.jsx` - título: "Incêndio"
- `EmergenciaVitimasPage.jsx` - título: "Múltiplas Vítimas"
- `EmergenciaPanePage.jsx` - título: "Pane Elétrica"
- `EmergenciaQuimicoPage.jsx` - título: "Acidente Químico"
- `EmergenciaInundacaoPage.jsx` - título: "Inundação"
- `EmergenciaBombaPage.jsx` - título: "Ameaça de Bomba"
- `PlanoManualPage.jsx` - título: "Manual"
- `PlanoTimesPage.jsx` - título: "Times de Emergência"
- `PlanoApoioPage.jsx` - título: "Apoio"
- `PlanoSimuladoPage.jsx` - título: "Simulado SRPA"
```

### 16.2 DocumentoCard

**Arquivo:** `src/components/DocumentoCard.jsx`

**Props:**
```jsx
<DocumentoCard
  documento={doc}
  onClick={() => handleClick(doc.id)}
  compact={true}  // Para grid 2 colunas
/>
```

**Estilos:**
- Badge de tipo com cor
- Título com hifenização (`hyphens-auto lang="pt-BR"`)
- Código discreto
- Ícone de tipo
- Sombra sutil

### 16.3 TipoTabs

**Arquivo:** `src/components/TipoTabs.jsx`

**Props:**
```jsx
<TipoTabs
  tipos={['todos', 'protocolo', 'politica', ...]}
  tipoAtivo={selectedTipo}
  onChange={(tipo) => setSelectedTipo(tipo)}
/>
```

**Estilos:**
- Scroll horizontal no mobile
- Chips com cores por tipo
- Estado ativo destacado
- Contador opcional

---

## 17. MOCK DATA

### 17.1 mockDocumentos

**Arquivo:** `src/data/mockDocumentos.js`

**Estrutura:**
```javascript
export const mockDocumentos = [
  {
    id: 'doc-001',
    codigo: 'PRT-001',
    titulo: 'Protocolo de Anestesia Geral',
    tipo: 'protocolo',
    status: 'ativo',
    versaoAtual: '2.1',
    createdAt: '2024-01-15',
    updatedAt: '2025-01-10',
    autor: 'Dr. Silva',
    descricao: 'Descrição do documento...',
    versoes: [
      { numero: '2.1', data: '2025-01-10', ... },
      { numero: '2.0', data: '2024-06-01', ... },
    ],
    pdfUrl: '/path/to/file.pdf',
    tags: ['anestesia', 'geral', 'procedimento'],
  },
  // ... mais documentos
];
```

### 17.2 Tipos de Documento

| Tipo | Código | Cor |
|------|--------|-----|
| protocolo | PRT | #059669 |
| politica | POL | #6366F1 |
| formulario | FRM | #F59E0B |
| manual | MAN | #EC4899 |
| relatorio | REL | #3B82F6 |
| processo | PRC | #8B5CF6 |
| termo | TRM | #14B8A6 |
| risco | RSC | #DC2626 |
| plano | PLN | #0891B2 |

### 17.3 Funções Auxiliares

```javascript
// Obter label do tipo
const getTipoLabel = (tipo) => {
  const labels = {
    protocolo: 'Protocolo',
    politica: 'Política',
    formulario: 'Formulário',
    manual: 'Manual',
    relatorio: 'Relatório',
    processo: 'Processo',
    termo: 'Termo',
    risco: 'Risco',
    plano: 'Plano',
  };
  return labels[tipo] || tipo;
};

// Formatar data
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
};

// Filtrar documentos
const filteredDocs = mockDocumentos.filter(doc => {
  const matchSearch = doc.titulo.toLowerCase().includes(query) ||
                      doc.codigo.toLowerCase().includes(query);
  const matchTipo = !selectedTipo || doc.tipo === selectedTipo;
  return matchSearch && matchTipo && doc.status === 'ativo';
});
```

### 17.4 mockEtica

**Arquivo:** `src/data/mockEtica.js`

**Estrutura:**
```javascript
export const mockEticaDocumentos = [
  {
    id: 'etica-1',
    titulo: 'Protocolo de Decisoes em Fim de Vida',
    codigo: 'ETI.DIL.0001-01',
    tipo: 'etica',
    categoria: 'dilemas',  // dilemas | parecerUti | diretrizes | emissaoParecer | codigoEtica
    status: 'ativo',       // ativo | arquivado
    versaoAtual: 2,
    setor: 'Comite de Etica',
    responsavel: 'Dr. Carlos Mendes',
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-06-20'),
    proximaRevisao: new Date('2025-06-20'),
    descricao: 'Protocolo para tomada de decisoes eticas...',
    tags: ['fim de vida', 'dilemas', 'bioetica'],
  },
  // ... 11 documentos totais (10 ativos + 1 arquivado)
];
```

**Categorias e Badges:**
| Categoria | Badge | Ícone | Collection Firestore |
|-----------|-------|-------|---------------------|
| dilemas | Dilemas | Brain | etica_dilemas_documentos |
| parecerUti | UTI | Heart | etica_parecer_uti_documentos |
| diretrizes | Diretrizes | BookOpen | etica_diretrizes_documentos |
| emissaoParecer | Parecer | FileText | etica_parecer_tecnico_documentos |
| codigoEtica | Codigo | Scale | etica_codigo_documentos |

**Configuração:** `src/data/eticaConfig.js` (ETICA_CONFIGS)

### 17.5 mockAtalhos (Atalhos Rápidos)

**Arquivo:** `src/data/mockAtalhos.js`

**33 atalhos disponíveis em 7 categorias:**

| Categoria | Qtd | IDs |
|-----------|-----|-----|
| Ferramentas | 4 | calculadoras, checklist, manutencao, conciliacao |
| Gestão | 4 | financeiro, escalas, qualidade-hub, faturamento |
| Qualidade | 8 | reportar, indicadores, auditorias, etica, desastres, medicamentos, incidentes, relatorios |
| Documentos | 4 | protocolos, biblioteca, infeccao, gestao-documental |
| Educação | 5 | rops, podcasts, residencia, educacao-continuada, ranking-rops |
| Organização | 3 | organograma, comites, reunioes |
| Comunicação | 4 | comunicados, pendencias, mensagens, meus-relatos |

**Constantes exportadas:**
- `ATALHOS_DISPONIVEIS` - Array com todos os 33 atalhos (id, label, icon, categoria, descricao)
- `CATEGORIAS` - 7 categorias (ferramentas, gestao, qualidade, documentos, educacao, organizacao, comunicacao)
- `ATALHOS_PADRAO` - 4 atalhos iniciais: calculadoras, reportar, manutencao, rops
- `MAX_ATALHOS` - Limite de 4 atalhos selecionados

**Persistência:** localStorage (`anest_atalhos`) via `carregarAtalhosSalvos()` / `salvarAtalhos()`

**Navegação (HomePage.jsx navigationMap):**
Os atalhos mapeiam para páginas reais do App.jsx:
- `rops` → `ropsDesafio`, `podcasts` → `ropsPodcasts`, `educacao-continuada` → `educacaoContinuada`
- `mensagens` → `inbox`, `meus-relatos` → `meusRelatos`, `gestao-documental` → `gestaoDocumental`
- `faturamento` → `faturamento`, `incidentes` → `incidentes`, `relatorios` → `relatorios`
- `ranking-rops` → `ropsRanking`

**Componentes relacionados:**
- `QuickLinksGrid` (`quick-links-grid.jsx`) - Grid visual com iconMap (33 ícones Lucide)
- `PersonalizarAtalhosPage` - Página de seleção de atalhos com preview e categorias

### 17.6 searchUtils (Busca Unificada)

**Arquivo:** `src/data/searchUtils.js`

**Função principal:** `searchAll(query)` — busca em memória (sem API) filtrando `ATALHOS_DISPONIVEIS` e `mockBibliotecaDocumentos`.

**Retorno:**
```javascript
{ pages: [...], documents: [...] }
```

- `pages`: atalhos que matcham (com `route` adicionada via `navigationMap`)
- `documents`: documentos da biblioteca que matcham (título, descrição, código, tags)
- Normalização com remoção de acentos (`normalize('NFD')`) para busca case-insensitive em PT-BR

**Uso na HomePage (Busca Inline com Dropdown):**
```javascript
const results = useMemo(() => searchAll(search), [search]);
const showDropdown = search.trim().length > 0;
```

**Comportamento do dropdown:**
- Aparece ao digitar (live search), fecha ao clicar fora (onBlur 200ms) ou ao selecionar resultado
- Máximo **5 seções** e **4 documentos** exibidos
- `max-h-[60vh]` com overflow scroll, `z-50` para stacking
- Seções: ícone (via `iconMap` com 30+ ícones Lucide) + label + descrição + chevron → `onNavigate(page.route)`
- Documentos: FileSearch ícone + título + descrição + chevron → `onNavigate('documento-detalhe', { documentoId })`
- "Nenhum resultado encontrado" quando query não produz matches
- Enter/Search no teclado faz blur (fecha teclado + dropdown)
- `SearchResultsPage` continua existindo mas não é mais acessada via HomePage

### 17.7 mockComunicados (Comunicados Qmentum)

**Arquivo:** `src/data/mockComunicados.js`

**Importações:** Importa `mockUsers` de `mockPermissions.js` para cálculo real de destinatários.

**Estrutura de um comunicado:**
```javascript
{
  id: 'com-1',
  tipo: 'Urgente',           // Urgente | Importante | Informativo | Evento | Geral
  titulo: 'Título...',
  conteudo: 'Corpo do comunicado...',
  link: 'https://...',       // opcional
  dataEvento: '2024-02-10T08:00:00', // opcional (tipo Evento)
  anexos: [{ nome, url, tamanho, tipo }],
  autorId: 'user-001',
  autorNome: 'Dr. Carlos Silva',
  createdAt: '2024-01-15T10:30:00',
  lido: false,
  arquivado: false,
  // Campos Qmentum
  destinatarios: ['anestesiologista', 'medico-residente', 'enfermeiro'], // [] = todos
  leituraObrigatoria: true,
  confirmacoes: [{ userId, userName, confirmedAt }],
  ropArea: 'cultura-seguranca',  // key de ROP_AREAS
  acoesRequeridas: [{ id, texto }],
  acoesCompletadas: [{ acaoId, userId, userName, completedAt }],
  status: 'publicado',       // rascunho | aprovado | publicado
  aprovadoPor: { userId, userName, approvedAt },
  prazoConfirmacao: '2024-01-20T23:59:00',
  dataValidade: null,
}
```

**Helpers exportados:**

| Função | Descrição |
|--------|-----------|
| `calcularTotalDestinatarios(comunicado)` | Calcula total real de destinatários com base em `mockUsers` ativos (não mais estimativa) |
| `isPrazoVencido(comunicado)` | Verifica se prazo de confirmação venceu |
| `isExpirado(comunicado)` | Verifica se comunicado expirou (dataValidade) |
| `formatRelativeDate(dateString)` | "há X min/horas/dias" |
| `formatFullDate(dateString)` | "15 de janeiro de 2024" |
| `formatCardDate(dateString)` | "15/01/2024" |
| `formatEventDate(dateString)` | "10 de fevereiro de 2024, 08:00" |
| `getTipoColor(tipo)` | Cor hex por tipo de comunicado |
| `getFileIcon(filename)` | Ícone por extensão de arquivo |

**Constantes exportadas:**

| Constante | Descrição |
|-----------|-----------|
| `ROLES_DESTINATARIOS` | 8 roles com key/label |
| `ROP_AREAS` | 7 áreas ROP com key/label/color |
| `STATUS_COMUNICADO` | 3 status com key/label/color |
| `tipoColors` | Mapa tipo → cor hex |
| `tiposComunicado` | Array de tipos com value/label/color |

**Mock data:** 6 comunicados (3 com leitura obrigatória, 3 com ações requeridas, 1 evento, 1 expirado).

---

## 18. MCPs - MODEL CONTEXT PROTOCOL (NOVO)

### 18.1 Regra Obrigatória

```
╔══════════════════════════════════════════════════════════════════╗
║  SEMPRE pesquisar nos MCPs ANTES de implementar qualquer código!  ║
╚══════════════════════════════════════════════════════════════════╝
```

### 18.2 MCPs Disponíveis

#### context7 - Documentação Técnica
**Quando usar:** Documentação de React, Firebase, Tailwind, bibliotecas

```
Exemplos de uso:
- "Use context7 para buscar documentação do Firebase Auth v9"
- "Use context7 para verificar a API do useEffect no React 19"
- "Use context7 para buscar padrões de Framer Motion"
```

#### shadcn - Padrões de Componentes UI
**Quando usar:** Criar componentes UI, padrões de acessibilidade, variantes

```
Exemplos de uso:
- "Use shadcn MCP para verificar padrão de Button com variants"
- "Use shadcn MCP para ver implementação de Modal acessível"
- "Use shadcn MCP para buscar padrão de Form validation"
```

#### firecrawl - Pesquisa Online
**Quando usar:** Best practices, soluções para problemas específicos, tutoriais

```
Exemplos de uso:
- "Use firecrawl para buscar best practices de React Query"
- "Use firecrawl para pesquisar solução para hydration error"
- "Use firecrawl para buscar padrões de autenticação Firebase"
```

#### figma-desktop - Especificações de Design
**Quando usar:** Extrair cores, espaçamentos, tipografia de mockups

```
Exemplos de uso:
- "Use figma MCP para extrair cores do frame 'Home - Light Mode'"
- "Use figma MCP para verificar espaçamentos do card"
```

#### playwright - Testes E2E
**Quando usar:** Criar testes end-to-end, automação de browser

```
Exemplos de uso:
- "Use playwright MCP para criar teste de login"
- "Use playwright MCP para testar fluxo de navegação"
```

### 18.3 Fluxo Obrigatório de Pesquisa

```
1. IDENTIFICAR a tarefa
   └─> Qual área? (UI, Firebase, animação, teste...)

2. PESQUISAR documentação
   └─> context7: documentação oficial da tecnologia

3. VERIFICAR padrões
   └─> shadcn: padrões de componentes UI

4. BUSCAR soluções
   └─> firecrawl: best practices e tutoriais online

5. IMPLEMENTAR
   └─> Agora sim, começar a codar

6. VALIDAR
   └─> playwright: testes E2E (quando aplicável)
```

### 18.4 Configuração dos MCPs (~/.cursor/mcp.json)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@anthropics/context7-mcp"]
    },
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@anthropics/shadcn-mcp"]
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "your-api-key"
      }
    },
    "figma-desktop": {
      "command": "npx",
      "args": ["-y", "@anthropics/figma-mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropics/playwright-mcp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropics/github-mcp"],
      "env": {
        "GITHUB_TOKEN": "your-token"
      }
    }
  }
}
```

---

## 19. FASES DO PROJETO (NOVO)

### 19.1 Visão Geral

| Fase | Status | Progresso |
|------|--------|-----------|
| Fases 1-9 | ✅ Completas | 64% |
| Fase 10 | 🔄 Em andamento | +5% |
| Fases 11-14 | ⏳ Pendentes | 31% |

### 19.2 Fases Completas (1-9) ✅

#### Fase 1: Setup Inicial
- [x] Projeto Vite + React 19
- [x] Tailwind CSS configurado
- [x] Estrutura de pastas
- [x] ESLint + Prettier

#### Fase 2: Design Tokens
- [x] Cores Light Mode
- [x] Cores Dark Mode
- [x] Tipografia
- [x] Espaçamentos
- [x] Border radius
- [x] Sombras

#### Fase 3: Componentes Base
- [x] Button (variants, sizes)
- [x] Card (header, footer)
- [x] Badge
- [x] Avatar
- [x] Input
- [x] Skeleton

#### Fase 4: Layout & Navegação
- [x] Header
- [x] BottomNav
- [x] Sidebar
- [x] Tabs
- [x] Breadcrumb

#### Fase 5: Formulários
- [x] Select
- [x] Checkbox
- [x] RadioGroup
- [x] Textarea
- [x] Switch
- [x] DatePicker
- [x] FileUpload
- [x] FormField

#### Fase 6: Feedback
- [x] Toast (useToast)
- [x] Modal
- [x] Alert
- [x] Progress
- [x] Spinner
- [x] EmptyState
- [x] ConfirmDialog

#### Fase 7: Data Display
- [x] Table
- [x] DataGrid
- [x] Calendar
- [x] Timeline
- [x] ChartContainer
- [x] DonutChart
- [x] SparklineChart

#### Fase 8: Utilitários & Mídia
- [x] Tooltip
- [x] Popover
- [x] Accordion
- [x] Collapsible
- [x] ScrollArea
- [x] AudioPlayer
- [x] PDFViewer
- [x] QRCode

#### Fase 9: Gamificação & ANEST
- [x] Quiz
- [x] Leaderboard
- [x] Achievement
- [x] Checklist
- [x] 24 componentes ANEST
- [x] ScoreTracker
- [x] RiskFactorCard
- [x] KPICard
- [x] CalculadoraCard

#### Fase 9.5: Sistema de KPIs Completo (17/01/2026) ✅
- [x] KPIDataProvider com `storageKey` para isolamento de localStorage
- [x] KPIEditor com suporte a 12 meses (Jan-Dez)
- [x] KPICard com tratamento de valores `null` no gráfico e média
- [x] PainelGestaoPage com 21 indicadores de qualidade anestésica
- [x] Transformação automática de dados com último valor não-null
- [x] Período dinâmico baseado no último mês com dados
- [x] indicadores-2025.js com dados mensais e funções auxiliares (parseMeta, evaluateStatus)
- [x] Integração com KPIEditor para admins gerenciarem indicadores

### 19.3 Fase 10: Backend Integration 🔄 (Em Andamento)

**Concluído:**
- [x] Firebase config
- [x] Estrutura de services
- [x] Auth service (login, register, logout) via Firebase Auth
- [x] AuthContext + useAuth hook
- [x] Login/Logout funcional
- [x] Upload service com mock fallback

**Decisão arquitetural (v3.26):** Abordagem híbrida **Firebase Auth + Supabase**
- Firebase Auth mantido para autenticação (já funcional)
- Supabase (PostgreSQL) para gestão documental (audit trail, FTS, RLS)
- Plano completo em `~/.claude/plans/groovy-knitting-noodle.md`

**Concluído (v3.33.0):**
- [x] Criar projeto Supabase (região us-west-2, ref: vjzrahruvjffyyqyhjny)
- [x] Schema PostgreSQL — 5 tabelas: documentos, versoes, changelog, aprovacoes, **incidentes**
- [x] supabaseDocumentService.js (CRUD + FTS + changelog + distribuição + aprovação)
- [x] supabaseIncidentsService.js (CRUD + real-time + rastreamento anônimo)
- [x] Integrar DocumentsContext.jsx com Supabase (dual-path USE_MOCK)
- [x] Integrar IncidentsContext.jsx com Supabase (dual-path USE_MOCK)
- [x] Row Level Security (RLS) para RBAC em documentos e incidentes
- [x] Firebase Auth + Supabase JWT (HS256, jose library)
- [ ] Migrar uploadService.js para Supabase Storage (pendente)
- [ ] Seed de dados mock para Supabase (pendente)

**Conexão Supabase:**
- Pooler: `aws-0-us-west-2.pooler.supabase.com:6543`
- User: `postgres.vjzrahruvjffyyqyhjny`
- Config: `src/config/supabase.js` (Firebase Auth JWT → Supabase HS256)

### 19.4 Fases Pendentes (11-14) ⏳

#### Fase 11: Testes E2E
- [ ] Setup Playwright
- [ ] Teste de login
- [ ] Teste de navegação
- [ ] Teste de CRUD documentos
- [ ] Teste de calculadoras
- [ ] CI/CD integration

#### Fase 12: PWA
- [ ] Manifest.json
- [ ] Service Worker
- [ ] Offline support
- [ ] Push notifications
- [ ] Install prompt

#### Fase 13: Deploy
- [ ] Firebase Hosting setup
- [ ] Environment variables
- [ ] Build optimization
- [ ] Domain configuration
- [ ] SSL certificate

#### Fase 14: Otimização
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Image optimization
- [ ] Bundle analysis
- [ ] Performance audit
- [ ] Lighthouse score > 90

### 19.5 Métricas do Projeto

| Métrica | Atual | Meta |
|---------|-------|------|
| Componentes UI | 57 | 57 ✅ |
| Componentes ANEST | 24 | 24 ✅ |
| Hooks | 15+ | 15 ✅ |
| Showcases | 16 | 16 ✅ |
| Calculadoras | 25+ | 25 ✅ |
| Cobertura de testes | 0% | 80% |
| Lighthouse Score | - | > 90 |

### 19.6 Prioridade Atual

```
╔═══════════════════════════════════════════════╗
║  Fase 10 - Supabase Integration ✅ CONCLUÍDA   ║
║                                                ║
║  FOCO ATUAL:                                   ║
║  1. USE_MOCK=false em produção                 ║
║  2. Migrar uploads para Supabase Storage       ║
║  3. Testes E2E (Fase 11)                       ║
║  4. PWA + Offline (Fase 12)                    ║
║  5. Deploy otimizado (Fase 13)                 ║
╚═══════════════════════════════════════════════╝
```

---

## 20. PADRÕES DE NAVEGAÇÃO REACT (NOVO)

### 20.1 Problema: useState Ignora Props em Re-render

O React `useState` só usa o valor inicial no **primeiro mount**. Mudanças em props após o mount são ignoradas.

**Problema comum:**
```jsx
// ❌ ERRADO - activeTab não atualiza quando params muda
function Page({ params }) {
  const [activeTab, setActiveTab] = useState(params?.returnTab || 'default');
  // Se params mudar, activeTab NÃO atualiza!
}
```

### 20.2 Solução: KEY Prop + Lazy State Initialization

**Padrão validado pelo React Team e TkDodo:**

#### Passo 1: Adicionar KEY prop no componente pai (App.jsx)
```jsx
// ✅ CORRETO - Key força remount quando returnTab muda
case 'permissions':
  return (
    <PermissionsPage
      key={`permissions-${pageParams?.returnTab || 'default'}`}
      onNavigate={handleNavigate}
      params={pageParams}
    />
  );
```

#### Passo 2: Usar Lazy State Initialization
```jsx
// ✅ CORRETO - Função é executada no mount, usa params atual
function PermissionsPage({ params }) {
  const [activeTab, setActiveTab] = useState(() => {
    return params?.returnTab || 'users';
  });
}
```

### 20.3 Por Que Funciona

1. **KEY prop**: Quando a key muda, React desmonta e remonta o componente completamente
2. **Lazy initialization**: A função `() => params?.returnTab || 'users'` executa no mount e usa o valor atual de params
3. **Sem flash visual**: Componente já monta com o estado correto

### 20.4 Quando Usar Este Padrão

| Situação | Usar KEY + Lazy? |
|----------|-----------------|
| Estado inicial depende de props | ✅ Sim |
| Preservar aba/tab ao voltar de outra página | ✅ Sim |
| Preservar scroll position | ❌ Não (usar useRef) |
| Estado independente de props | ❌ Não |

### 20.5 Referências

- [TkDodo - Putting props to useState](https://tkdodo.eu/blog/putting-props-to-use-state)
- [React Docs - useState](https://react.dev/reference/react/useState)
- [BobbyHadz - Update state when props change](https://bobbyhadz.com/blog/react-update-state-when-props-change)

### 20.6 Sistema de Histórico de Navegação (goBack)

#### Problema
O padrão anterior de navegação usava `returnTo` e `returnTab` como parâmetros explícitos, que eram frágeis e não preservavam o histórico real de navegação. Usuários esperavam que "Voltar" funcionasse como o botão voltar do navegador.

#### Solução Implementada

**Arquivos modificados:**
- `src/App.jsx` - Controlador principal de navegação
- `src/design-system/showcase/PagesShowcase.jsx` - Showcase de páginas

**Padrão de implementação:**

```jsx
// 1. Estado do histórico no componente pai
const [navigationHistory, setNavigationHistory] = useState([]);

// 2. Modificar handleNavigate para salvar no histórico
const handleNavigate = (page, params = null) => {
  // Salvar estado atual ANTES de navegar
  if (currentPage) {
    setNavigationHistory(prev => [...prev, {
      page: currentPage,
      params: pageParams
    }]);
  }
  setCurrentPage(page);
  setPageParams(params);
};

// 3. Função goBack usando o histórico
const goBack = () => {
  if (navigationHistory.length === 0) {
    // Sem histórico, voltar para home
    setCurrentPage('home');
    setPageParams(null);
    return;
  }

  // Pegar última entrada e remover do histórico
  const newHistory = [...navigationHistory];
  const previous = newHistory.pop();

  setNavigationHistory(newHistory);
  setCurrentPage(previous.page);
  setPageParams(previous.params);
};

// 4. Passar goBack para páginas
<ProfilePage onNavigate={handleNavigate} goBack={goBack} />
<DocumentoDetalhePage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
<PermissionsPage onNavigate={handleNavigate} goBack={goBack} params={pageParams} />
```

**Uso nas páginas:**

```jsx
// ❌ ANTES - navegação hardcoded
const handleGoBack = () => {
  if (returnTab) {
    onNavigate(returnTo, { returnTab });
  } else {
    onNavigate(returnTo);
  }
};

// ✅ DEPOIS - usando goBack
const handleGoBack = () => {
  goBack();
};

// No botão voltar do header
<button onClick={goBack}>
  <ChevronLeft /> Voltar
</button>
```

#### Páginas que recebem goBack

| Página | Arquivo |
|--------|---------|
| ProfilePage | ProfilePage.jsx |
| DocumentoDetalhePage | DocumentoDetalhePage.jsx |
| PermissionsPage | PermissionsPage.jsx |
| MenuPage | MenuPage.jsx |
| BibliotecaPage | BibliotecaPage.jsx |
| GestaoPage | GestaoPage.jsx |
| CalculadorasPageWrapper | App.jsx |
| IncidentesPage | IncidentesPage.jsx |
| NovoIncidentePage | NovoIncidentePage.jsx |
| NovaDenunciaPage | NovaDenunciaPage.jsx |
| MeusRelatosPage | MeusRelatosPage.jsx |
| QRCodeGeneratorPage | QRCodeGeneratorPage.jsx |
| AcompanhamentoIncidentePage | AcompanhamentoIncidentePage.jsx |
| AcompanhamentoDenunciaPage | AcompanhamentoDenunciaPage.jsx |

### 20.7 Fix: ProfilePage User Null Check

#### Problema
ProfilePage causava página em branco quando `user` era `null` porque acessava propriedades sem verificar.

```jsx
// ❌ CRASH se user é null
const [editForm, setEditForm] = useState({
  firstName: user.firstName,  // TypeError
});

// ❌ CRASH
initials={`${user.firstName[0]}${user.lastName[0]}`}
```

#### Solução

```jsx
export default function ProfilePage({ onNavigate, goBack }) {
  const { user } = useUser();

  // 1. TODOS os hooks ANTES do early return (regra do React)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',  // Inicializa vazio
    lastName: '',
  });

  // 2. Early return DEPOIS dos hooks
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] flex items-center justify-center">
        <p className="text-[#6B7280]">Carregando perfil...</p>
      </div>
    );
  }

  // 3. Safe access com optional chaining para Avatar
  <Avatar
    initials={`${user.firstName?.[0] || '?'}${user.lastName?.[0] || '?'}`}
    src={user.avatar}
  />

  // 4. Função openEditModal popula form com dados do user
  const openEditModal = () => {
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      // ...
    });
    setIsEditing(true);
  };
}
```

#### Regras Importantes

1. **Hooks antes de early returns** - React exige que hooks sejam chamados incondicionalmente
2. **Inicializar com valores vazios** - Form state não depende de user no mount
3. **Optional chaining para strings** - `user.firstName?.[0]` previne crash em strings vazias
4. **Fallback values** - `|| '?'` garante sempre ter um valor para initials

### 20.8 Fix: Scroll to Top on Navigation

#### Problema
Ao navegar entre páginas (ex: Home → Permissões), a página abria no meio em vez de no topo. Isso acontecia porque `window.scrollTo(0, 0)` executado no handler de navegação ocorre antes do React renderizar o novo conteúdo.

#### Solução

**App.jsx** - Usar `useEffect` que executa após a renderização:

```jsx
import { useState, useEffect } from "react"

function App() {
  const [currentPage, setCurrentPage] = useState("home")

  // Scroll para o topo quando a página muda
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [currentPage])

  // ... resto do código
}
```

**PagesShowcase.jsx** - Scroll no container interno (não no window):

```jsx
import { useState, useEffect, useRef } from 'react';

export function PagesShowcase() {
  const [selectedPage, setSelectedPage] = useState(null);
  const scrollContainerRef = useRef(null);

  // Scroll para o topo quando a página muda
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [selectedPage]);

  // No JSX, adicionar ref ao container scrollável
  return (
    <div
      ref={scrollContainerRef}
      className="overflow-y-auto"
      style={{ height: '603px' }}
    >
      {/* Conteúdo da página */}
    </div>
  );
}
```

#### Por Que `useEffect` é Necessário

| Abordagem | Problema |
|-----------|----------|
| `scrollTo` no handler | Executa ANTES do React renderizar nova página |
| `scrollTo` em `useEffect` | Executa APÓS o componente montar/atualizar |

#### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/App.jsx` | Adicionado `useEffect` com `window.scrollTo` quando `currentPage` muda |
| `src/design-system/showcase/PagesShowcase.jsx` | Adicionado `useRef` + `useEffect` para scroll no container interno |

#### Comportamento `behavior: 'instant'`

- `'instant'` - Scroll imediato sem animação (recomendado para navegação)
- `'smooth'` - Scroll animado (útil para scroll dentro da mesma página)

---

## 21. SISTEMA DE DOCUMENTOS ARQUIVADOS (NOVO)

### 21.1 Funcionalidade

Documentos podem ser arquivados em vez de deletados permanentemente. Documentos arquivados:
- Ficam com `status: 'arquivado'`
- Podem ser restaurados
- Podem ser deletados permanentemente

### 21.2 Arquivos Envolvidos

| Arquivo | Função |
|---------|--------|
| `src/data/mockDocumentos.js` | Funções `archiveDocumento()`, `restoreDocumento()`, `deleteDocumento()` |
| `src/pages/PermissionsPage.jsx` | Sub-aba "Arquivados" na aba Docs |
| `src/pages/DocumentoDetalhePage.jsx` | Botão "Arquivar" no menu admin |

### 21.3 Sub-abas de Documentos (PermissionsPage)

```jsx
const DOC_SUBTABS = [
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'arquivados', label: 'Arquivados', icon: Archive },
];
```

### 21.4 Funções de Gestão

```javascript
// Arquivar documento (muda status para 'arquivado')
archiveDocumento(id);

// Restaurar documento (muda status para 'ativo')
restoreDocumento(id);

// Deletar permanentemente
deleteDocumento(id);
```

---

## 22. INTEGRAÇÃO API PEGA PLANTÃO

### 22.1 Visão Geral

Integração com a API Pega Plantão v1.7 para obter dados reais de plantões e escalas do sistema hospitalar.

### 22.2 Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `src/services/pegaPlantaoApi.js` | Serviço de API com autenticação OAuth 2.0, cache e endpoints |
| `src/hooks/usePegaPlantao.js` | Hook `useEscalaDia()` para consumo de dados |
| `src/pages/HomePage.jsx` | Card de Plantões (limitado a 4 itens) |
| `src/pages/EscalasPage.jsx` | Página completa "Escala do Dia" com todos os plantonistas |

### 22.3 Hook useEscalaDia

```jsx
import { useEscalaDia } from '../hooks/usePegaPlantao';

function MyComponent() {
  const {
    plantoesManha,      // Array de plantões da manhã (fins de semana)
    plantoesTarde,      // Array de plantões da tarde/noturno
    plantoes,           // Array combinado (plantoesCombinados = manha + tarde)
    plantoesFDS,        // Array deduplicado por setor (1 por P1-P11, só FDS)
    ferias,             // Array de férias programadas (apenas dias úteis)
    isWeekend,          // Boolean - true se modo FDS ativo (sáb 7h → seg 7h)
    periodoAtual,       // 'manha' ou 'tarde' baseado na hora atual
    expanded,           // Boolean - estado de expansão do card (FDS)
    toggleExpanded,     // Função para expandir/recolher card
    loading,            // Boolean - carregando dados
    error,              // Erro se houver
    usandoMock,         // Boolean - true se usando dados de demonstração
    refetch,            // Função para recarregar dados
  } = useEscalaDia();
}
```

### 22.4 Estrutura de Dados de Plantão

```javascript
{
  setor: 'P1',                    // Setor (P1-P11)
  hospital: 'Eduardo Savoldi',    // Nome do plantonista
  data: 'P1 - Diurno',            // Descrição do setor e período
  hora: '07:00',                  // Horário de início
  bgColor: '#B8E0C8',             // Cor de fundo (opcional)
}
```

### 22.5 Regras de Negócio

#### Modo FDS (48h contínuas)

Os plantonistas de **sábado** (P1-P11) ficam expostos por **48 horas**:
- **Início**: Sábado 07:00
- **Fim**: Segunda-feira 07:00
- **Dados**: Sempre busca dados de **sábado** na API (mesmo no domingo e segunda madrugada)
- **Troca de nomes**: Se a API atualizar um nome (troca), o nome novo aparece no próximo refresh (cache 5min)

| Momento | `isWeekendMode` | Data buscada na API | Plantões | Férias |
|---------|-----------------|---------------------|----------|--------|
| Sábado 00:00–06:59 | `false` | Sexta-feira | P1-P4 (Noturno) | Sim |
| Sábado 07:00–23:59 | `true` | **Sábado** | P1-P11 | Não |
| Domingo 00:00–23:59 | `true` | **Sábado** | P1-P11 | Não |
| Segunda 00:00–06:59 | `true` | **Sábado** | P1-P11 | Não |
| Segunda 07:00+ | `false` | Segunda-feira | P1-P4 (Noturno) | Sim |
| Terça a Sexta | `false` | Dia atual (ou anterior se madrugada) | P1-P4 (Noturno) | Sim |

#### Setores por Período

| Config | Setores |
|--------|---------|
| `diasUteis` | P1, P2, P3, P4 |
| `sabadoManha` | P1-P11 (todos) |
| `sabadoTarde` | P1-P11 (todos) |
| `domingo` | P1-P11 (todos) |

### 22.6 Card Plantões (HomePage)

- **maxItems={4}**: Mostra 4 plantonistas inicialmente
- **Dias úteis**: "Ver todos" navega para página `escalas`; Card de Férias aparece abaixo
- **Fins de semana (modo FDS)**: Card é **expandable** — "Ver todos" expande in-place mostrando P1-P11; "Recolher" fecha; usa `plantoesFDS` (deduplicado por setor)

```jsx
// Dias úteis: navega para escalas
// FDS: expande card in-place para mostrar todos os 11 plantonistas
<PlantaoCard
  title="Plantões"
  subtitle={getDiaSubtitle()}
  items={isWeekend ? plantoesFDS : plantoesCombinados}
  maxItems={4}
  showBadge={false}
  expandable={isWeekend && plantoesFDS.length > 4}
  expanded={expanded}
  onToggleExpand={toggleExpanded}
  onViewAll={!isWeekend || plantoesFDS.length <= 4 ? () => onNavigate('escalas') : undefined}
/>
```

### 22.7 Página EscalasPage

- Exibe **todos** os plantonistas do dia (maxItems={50})
- Header com data atual e botão de atualizar
- Usa `plantoesCombinados` (todos os períodos)
- Indicador de "Dados de demonstração" quando API falha

### 22.8 Proxy Vite (Desenvolvimento)

Configurado em `vite.config.js` para resolver CORS:

```javascript
proxy: {
  '/api/pegaplantao': {
    target: 'https://pegaplantao.com.br/api',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/pegaplantao/, ''),
  },
}
```

### 22.9 Credenciais (Configuradas)

As credenciais estão configuradas no serviço para autenticação OAuth 2.0.

### 22.10 Extração de Férias dos Plantões (Fix 19/01/2026)

#### Problema Identificado
A API retorna férias **dentro do endpoint de plantões** com `Setor = "Férias"`. O código anterior tentava buscar férias via `getProfissionaisDoGrupo()` + `getAfastamentosAtivos()`, que falhava porque:
1. A lista de profissionais retornava vazia
2. A função `extrairNumeroSetor()` ignorava itens com Setor = "Férias" (não tem P1-P11)

**Logs do problema:**
```
⚠️ [PegaPlantao] Plantão 0: setor não extraído de "Férias"
⚠️ [PegaPlantao] Nenhum profissional encontrado para buscar férias
```

#### Solução Implementada

**Arquivo**: `src/services/pegaPlantaoApi.js` - função `getPlantoesHojePorSetor()`

**Mudanças:**

1. **Filtrar plantões de férias** antes do loop principal:
```javascript
const plantoesFerias = plantoes.filter(p =>
  p.Setor && p.Setor.toLowerCase().includes('férias')
);
```

2. **Transformar férias no formato correto**:
```javascript
const feriasExtraidas = plantoesFerias.map(p => ({
  nome: p.ProfDePlantao || p.ProfFixo || 'Profissional',
  periodo: formatarPeriodo(p.Inicio, p.Fim),
  tipo: 'férias',
  codigo: p.CodigoPlantao,
}));
```

3. **Processar apenas plantões reais** (excluir férias do loop):
```javascript
const plantoesReais = plantoes.filter(p =>
  !p.Setor || !p.Setor.toLowerCase().includes('férias')
);
plantoesReais.forEach((plantao, index) => { ... });
```

4. **Usar férias extraídas no resultado** (removido bloco de busca via API):
```javascript
resultado.ferias = feriasExtraidas;
```

#### Logs Esperados (Console)
```
🏖️ [PegaPlantao] Férias extraídas dos plantões: 4
🏖️ [PegaPlantao] Em férias: Nome1, Nome2, Nome3, Nome4
```

#### Benefícios
- Usa dados já retornados pela API (sem requisições adicionais)
- Remove código morto (busca de profissionais e afastamentos)
- Card de férias agora exibe corretamente os profissionais
- Card de plantões exibe apenas P1-P4 (sem registros de férias)

### 22.11 Lógica de 24h de Exposição - Plantões Noturnos (Fix 05/02/2026)

#### Problema Identificado
1. **Bug de Timezone**: O código usava `toISOString()` que converte para UTC, causando datas erradas após 21:00 em Brasília (UTC-3). Exemplo: às 22:00 de quinta-feira, `toISOString().split('T')[0]` retornava sexta-feira.
2. **Lógica complexa**: A função tratava madrugada e dia como casos separados, quando a regra de negócio é simples: 24h de exposição.

#### Regra de Negócio
Plantonistas noturnos (19:00-07:00) ficam expostos por **24 horas**:
- **Início da exposição**: 07:00 do dia que inicia o plantão
- **Fim da exposição**: 07:00 do dia seguinte

**Exemplo:** Plantão de quinta 19:00 até sexta 07:00
- Aparece de: quinta 07:00 até sexta 07:00

#### Solução Implementada

**Arquivo alterado:** `src/services/pegaPlantaoApi.js`

**Novas funções:**

```javascript
// Formata data usando horário LOCAL (evita bug de timezone)
function formatarDataLocal(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Retorna a "data efetiva" para busca de plantões
// Antes das 7h: retorna dia anterior (plantão ainda em vigência)
// A partir das 7h: retorna dia atual
function getDataEfetiva(dataReferencia = new Date()) {
  const hora = dataReferencia.getHours();
  const dataEfetiva = new Date(dataReferencia);

  if (hora < 7) {
    dataEfetiva.setDate(dataEfetiva.getDate() - 1);
  }

  return dataEfetiva;
}
```

**Funções auxiliares existentes:**

```javascript
export const HORA_CORTE_PLANTAO = 7; // 7h da manhã

export function estaNaMadrugada(date = new Date()) {
  const hora = date.getHours();
  return hora >= 0 && hora < HORA_CORTE_PLANTAO;
}

export function plantaoEmAndamento(plantao, agora = new Date()) {
  const inicio = new Date(plantao.Inicio);
  const fim = plantao.Fim ? new Date(plantao.Fim) : null;
  if (!fim) return agora >= inicio;
  return agora >= inicio && agora < fim;
}
```

**Lógica simplificada em `getPlantoesHojePorSetor()`:**

| Horário | Data Efetiva | Mostra plantão de |
|---------|--------------|-------------------|
| Quinta 07:00 | Quinta | Quinta (19:00-07:00) |
| Quinta 22:55 | Quinta | Quinta (19:00-07:00) |
| Sexta 00:00 | Quinta | Quinta (19:00-07:00) |
| Sexta 06:59 | Quinta | Quinta (19:00-07:00) |
| Sexta 07:00 | Sexta | Sexta (19:00-07:00) |

**Logs de debug no console:**
```
📅 [PegaPlantao] Data de referência: 2026-02-05 - Quinta
📅 [PegaPlantao] Hora atual: 22
📅 [PegaPlantao] Data efetiva (para busca): 2026-02-05
📅 [PegaPlantao] Fim de semana: false
📋 [PegaPlantao] DIA ÚTIL - Plantões noturnos da data efetiva: 4
```

**Benefícios:**
- Corrige bug de timezone (usa horário local, não UTC)
- Lógica unificada e mais simples de entender
- Card nunca fica vazio em dias úteis
- Plantonistas permanecem visíveis por 24h (07:00 a 07:00)

#### Outras Alterações (05/02/2026)

1. **Card Férias**: Título alterado de "Férias Programadas" para "Férias"
2. **Card Férias**: Período não repete data quando início = fim (ex: "05/02" em vez de "05/02 - 05/02")
3. **Residentes atualizados**: R1 (em branco, João, Roosewelt), R2 (Daniel, Jacinta, Rodrigo), R3 (Raffaela, Wagner)

### 22.12 Plantões FDS 48h - P1 a P11 (Fix 08/02/2026)

#### Problema Identificado
1. **Filtro `plantaoEmAndamento`** descartava plantões cujo turno já havia encerrado. Às 23h de domingo, apenas P11 aparecia (o único sem horário de fim definido na API).
2. **Domingo buscava dados de domingo** na API, quando deveria buscar **sábado** (plantonistas de sábado ficam 48h).
3. **`SETORES_CONFIG.domingo`** tinha apenas 7 setores (P1-4, P7-8, P11) e `sabadoTarde` tinha 9 (faltavam P7-8).

#### Regra de Negócio
Plantonistas de **sábado** (P1-P11) ficam expostos por **48 horas contínuas**: sábado 07:00 → segunda 07:00.

#### Solução Implementada

**Arquivos alterados:**
- `src/services/pegaPlantaoApi.js`
- `src/hooks/usePegaPlantao.js`
- `src/pages/HomePage.jsx`
- `src/pages/EscalasPage.jsx`
- `src/design-system/components/anest/plantao-card.jsx`

**Novas funções em `pegaPlantaoApi.js`:**

```javascript
// Modo FDS: sáb 7h → seg 7h (exclui sáb madrugada que ainda é sexta noite)
export function isWeekendMode(date) {
  const dia = date.getDay(), hora = date.getHours();
  if (dia === 6 && hora >= 7) return true;  // Sábado 7h+
  if (dia === 0) return true;               // Domingo todo
  if (dia === 1 && hora < 7) return true;   // Segunda madrugada
  return false;
}

// Sempre retorna o sábado do FDS atual
function getSabadoDoFDS(date) {
  const dia = date.getDay();
  const result = new Date(date);
  if (dia === 0) result.setDate(result.getDate() - 1); // Dom → Sáb
  if (dia === 1) result.setDate(result.getDate() - 2); // Seg → Sáb
  return result;
}
```

**Mudanças em `getPlantoesHojePorSetor()`:**

1. **Usa `isWeekendMode()`** (não `isWeekend()`) para detecção de FDS
2. **Usa `getSabadoDoFDS()`** como data efetiva no modo FDS (sempre sábado)
3. **Removido filtro `plantaoEmAndamento`** para FDS — mostra TODOS os plantões do sábado
4. **Setores**: usa `dataEfetiva` (sábado) para determinar config → `sabadoManha` = P1-P11

**Mudanças em `usePegaPlantao.js`:**

1. **`plantoesFDS`**: nova propriedade — deduplicação por setor (1 plantonista por P1-P11)
2. **Mock FDS**: sempre retorna mock de sábado durante modo FDS
3. **`SETORES_CONFIG`**: `sabadoTarde` e `domingo` agora têm todos os 11 setores

**Mudanças no `PlantaoCard`:**

1. Quando `expandable=true`: botão mostra texto **"Ver todos"** (colapsado) / **"Recolher"** (expandido) em vez de ícone chevron
2. Botão "Ver todos" com navegação só aparece quando `expandable=false`

**Mudanças na `HomePage`:**

1. FDS: usa `plantoesFDS` (deduplicado) em vez de `plantoesCombinados`
2. FDS: card é `expandable` com "Ver todos" expandindo in-place (mostra P1-P11)
3. Dias úteis: mantém comportamento anterior (navega para escalas)

**Mudanças na `EscalasPage`:**

1. Usa `plantoesCombinados` sempre (não mais `plantoesManha` só para FDS)

---

## 23. SISTEMA DE ORGANOGRAMA

### 23.1 Visão Geral

Sistema interativo de visualização e edição da estrutura organizacional da ANEST, com:
- **Accordion expansível** para navegação hierárquica
- **Linhas conectoras** visuais mostrando hierarquia
- **Persistência no Firebase** (collection `configuracoes`, doc `organograma`)
- **Modo de edição** para admins (adicionar/editar/remover cargos)
- **Bottom sheet de detalhes** com informações do cargo

### 23.2 Arquivos do Sistema

```
src/components/organograma/
├── index.js                 # Export centralizado
├── OrgAccordion.jsx         # Container principal com controles
├── OrgAccordionItem.jsx     # Item recursivo (card do cargo)
├── OrgAdvisoryBadge.jsx     # Badge para comitês consultivos
├── OrgControls.jsx          # Botões Expandir/Colapsar
├── OrgDetailModal.jsx       # Bottom sheet de detalhes
├── OrgEditModal.jsx         # Modal de edição/criação
└── orgNodeColors.js         # Paleta de cores por tipo

src/data/organogramaData.js  # Estrutura de dados e helpers
src/hooks/useOrganograma.js  # Hook para Firebase CRUD
src/pages/OrganogramaPage.jsx # Página principal
```

### 23.3 Tipos de Nós (NODE_TYPES)

| Tipo | Label | Cor (Light) | Ícone |
|------|-------|-------------|-------|
| `governance` | Governança | #006837 (verde escuro) | Building2 |
| `executive` | Executivo | #1565C0 (azul) | UserCog |
| `technical` | Técnico | #FF9800 (laranja) | Stethoscope |
| `admin` | Administrativo | #7D8B69 (oliva) | ClipboardList |
| `committee` | Comitê | #4CAF50 (verde) | Users |
| `operational` | Operacional | #9E9E9E (cinza) | Briefcase |
| `advisory` | Consultivo | #9E9E9E (borda tracejada) | MessageSquare |

### 23.4 Estrutura de Dados

```javascript
// Estrutura de um nó
{
  id: 'unique-id',
  cargo: 'Nome do Cargo',
  tipo: 'committee',           // Um dos NODE_TYPES
  linkType: 'solid',           // 'solid' ou 'dotted'
  responsavel: 'Nome' | ['Nome1', 'Nome2'] | null,  // String, array ou null
  descricao: 'Descrição do cargo',
  contato: 'email@anest.com.br' | ['email1', 'email2'] | null,
  children: [],                // Filhos hierárquicos
  advisory: []                 // Comitês consultivos (apenas em executive)
}
```

### 23.5 Hook useOrganograma

```javascript
const {
  data,           // Estrutura do organograma
  loading,        // Estado de carregamento
  saving,         // Estado de salvamento
  error,          // Erro (se houver)
  addChild,       // Adicionar filho: (parentId, nodeData, userId)
  addAdvisory,    // Adicionar consultivo: (parentId, nodeData, userId)
  update,         // Atualizar nó: (nodeId, updates, userId)
  remove,         // Remover nó: (nodeId, userId)
  resetToDefault, // Resetar para dados default
} = useOrganograma();
```

### 23.6 Componentes

#### OrgAccordionItem
Card do cargo com:
- Barra de cor vertical (indicador de tipo)
- Ícone em container colorido
- Título e responsável
- Linhas conectoras (`border-l-2`) mostrando hierarquia
- Botões de ação no modo edição

#### OrgAdvisoryBadge
Badge para comitês consultivos:
- Borda tracejada (`border-dashed`)
- Layout mais compacto
- Ícone MessageSquare

#### OrgDetailModal
Bottom sheet com detalhes:
- Header centralizado com ícone grande
- Cards de informação (Responsável, Descrição, Contato)
- Suporte a múltiplos responsáveis/emails
- Botão de email clicável

#### OrgEditModal
Modal para criar/editar:
- Campos: Cargo, Tipo, Responsáveis (múltiplos), Descrição, Emails (múltiplos)
- Validação de email
- Preview do tipo selecionado

### 23.7 Hierarquia Padrão (ANEST 2025)

```
Assembleia Geral (governance)
└── Coordenador Geral (executive)
    ├── [ADVISORY] Comitê de Ética e Conduta
    ├── [ADVISORY] Comitê Executivo de Gestão
    ├── Responsável Técnico (technical)
    ├── Auxiliar Administrativo (admin)
    ├── Comitê de Gestão de Pessoas (committee)
    │   └── Equipe Assistencial (operational)
    ├── Comitê Financeiro (committee)
    ├── Comitê de Qualidade (committee)
    │   ├── Consultório (operational)
    │   │   ├── Ambulatório de Dor
    │   │   ├── Secretárias/Recepcionistas
    │   │   ├── Aux. Financeiro
    │   │   └── Telefonista
    │   ├── Assistência Hospitalar
    │   ├── Anestesia Ambulatorial
    │   └── Comunicação Interna/Externa
    ├── Comitê de Escalas (committee)
    ├── Comitê de Educação Continuada (committee)
    │   ├── Ed. Continuada
    │   └── Residência Médica
    └── Comitê de Tecnologia e Materiais (committee)
```

### 23.8 Firebase Rules

```javascript
// Em firestore.rules
match /configuracoes/{configId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAdmin();
}
```

### 23.9 Estilo Visual

- **Cards**: `rounded-lg`, `border border-[#E5E7EB]`, `px-3 py-2.5`
- **Linhas conectoras**: `border-l-2 border-[#C8E6C9]` com `ml-2 pl-3`
- **Ícones**: `w-9 h-9` em container `rounded-lg`
- **Texto título**: `text-[14px] font-semibold`
- **Advisory badges**: Borda tracejada, layout compacto

---

## 24. FORMULÁRIOS PÚBLICOS E QR CODES

### 24.1 Visão Geral

Sistema de formulários públicos acessíveis via QR Code para notificação de incidentes e denúncias. Permite que qualquer pessoa (mesmo sem conta no sistema) registre ocorrências.

### 24.2 Arquivos

| Arquivo | Localização | Descrição |
|---------|-------------|-----------|
| `formulario-incidente.html` | `public/` | Formulário público para notificação de incidentes |
| `formulario-denuncia.html` | `public/` | Canal de denúncia anônimo e confidencial |
| `qr-code.jsx` | `src/design-system/components/ui/` | Componente React para gerar QR codes |
| `QRCodeGeneratorPage.jsx` | `src/pages/incidents/` | Página para gerar QR codes dos formulários (cores DS green `#006837`) |
| `PrivacyPolicyModal.jsx` | `src/pages/incidents/components/` | Modal de Política de Privacidade LGPD (11 seções) |

### 24.3 Componente QRCode

```jsx
import { QRCode, QRCodeCard, QRCodeMini } from '@/design-system';

// QR Code básico
<QRCode
  value="https://anest-ap.web.app/formulario-incidente.html"
  size={200}
  level="M"  // L, M, Q, H (correção de erro)
  fgColor="#000000"
  bgColor="#FFFFFF"
/>

// Com card wrapper
<QRCodeCard
  value={url}
  title="Formulário de Incidente"
  description="Escaneie para notificar"
  showDownload={true}
  showCopy={true}
/>

// Mini (inline)
<QRCodeMini value={url} size={64} />
```

**Dependência:** `qrcode` (npm package) - Gera QR codes reais e escaneáveis.

### 24.4 Formulários HTML Públicos

Os formulários são arquivos HTML estáticos em `public/` que:
- Carregam Firebase SDK diretamente (compat mode)
- Não requerem autenticação para envio
- Salvam dados diretamente no Firestore
- Geram protocolo e código de rastreio automaticamente

**Estrutura do formulário-incidente.html:**
```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>

<script>
  // Inicialização
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // Salvar incidente
  await db.collection('incidentes').add({
    protocolo: 'INC-YYYYMMDD-XXXX',
    trackingCode: 'ANEST-YYYY-XXXXXX',  // se anônimo
    isAnonimo: boolean,
    notificante: { nome, funcao, setor, ramal, email } | null,
    incidente: { data, hora, local, tipo, severidade, descricao },
    impacto: { dano, acoes, sugestoes },
    source: 'externo',
    status: 'pendente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    gestaoInterna: { responsavel, dataAnalise, parecer, acaoCorretiva, dataResolucao }
  });
</script>
```

**Estrutura do formulario-denuncia.html:**
```html
<!-- Firebase SDK com Storage para anexos -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js"></script>

<script>
  const db = firebase.firestore();
  const storage = firebase.storage();

  // Upload de anexos
  for (const file of files) {
    const ref = storage.ref(`denuncias/${timestamp}_${file.name}`);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    anexosUrls.push({ nome: file.name, url });
  }

  // Salvar denúncia
  await db.collection('denuncias').add({
    protocolo: 'DEN-YYYYMMDD-XXXX',
    trackingCode: 'ANEST-YYYY-XXXXXX',
    denunciante: { isAnonimo, nome, email } | null,
    denuncia: { tipo, titulo, descricao, data, envolvidos, testemunhas, impacto },
    anexos: [{ nome, url }],
    source: 'externo',
    status: 'pendente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    gestaoInterna: { responsavel, dataAnalise, parecer, acaoCorretiva, dataResolucao }
  });
</script>
```

### 24.5 Coleções Firestore

| Coleção | Descrição | Criação Pública |
|---------|-----------|-----------------|
| `incidentes` | Notificações de incidentes e quase-erros | ✅ Sim |
| `denuncias` | Denúncias anônimas e confidenciais | ✅ Sim |

### 24.6 Regras de Segurança

**Firestore Rules (firestore.rules):**
```javascript
match /incidentes/{docId} {
  allow create: if true;  // Permite criação pública
  allow read, update, delete: if isAuthenticated();
}

match /denuncias/{docId} {
  allow create: if true;  // Permite criação pública
  allow read, update, delete: if isAuthenticated();
}
```

**Storage Rules (storage.rules):**
```javascript
// Pasta denuncias: upload público, leitura autenticada
match /denuncias/{allPaths=**} {
  allow read: if request.auth != null;
  allow write: if true;  // Upload público de evidências
}
```

### 24.7 Fluxo de Uso

```
1. Admin acessa QRCodeGeneratorPage
2. Seleciona tipo (Incidente ou Denúncia)
3. Gera QR Code com URL do formulário
4. Imprime/afixada em área estratégica

5. Usuário escaneia QR Code com celular
6. Abre formulário público no navegador
7. Preenche e envia (pode ser anônimo)
8. Recebe protocolo + código de rastreio

9. Dados salvos no Firestore
10. Gestores autenticados visualizam na lista
11. Podem gerenciar status e parecer
```

### 24.8 URLs dos Formulários

| Tipo | URL (Produção) |
|------|----------------|
| Incidente | `https://anest-ap.web.app/formulario-incidente.html` |
| Denúncia | `https://anest-ap.web.app/formulario-denuncia.html` |

---

## 25. DocumentsContext - Single Source of Truth

### 25.1 Visão Geral

O `DocumentsContext` é um Provider Pattern que centraliza todos os documentos do sistema em uma única fonte de verdade (SSOT). Isso garante que o **Centro de Gestão** e a **página Qualidade** sempre exibam os mesmos dados, sincronizados automaticamente.

**Problema Resolvido:**
```
ANTES:                                    DEPOIS:
Centro de Gestão → mockEtica.js          Centro de Gestão ─┐
Qualidade       → dados próprios?                          ├─→ DocumentsContext (SSOT)
Sub-páginas     → duplicados?            Qualidade        ─┘
```

### 25.2 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/types/documents.js` | Constantes, tipos, QMENTUM_CATEGORIES com pesos, COMPLIANCE_FLAGS, workflow de aprovação |
| `src/contexts/DocumentsContext.jsx` | Provider principal com estado, ações CRUD, overdueDocuments, upcomingReviews, pendingApproval |
| `src/hooks/useDocuments.js` | Hook geral + complianceMetrics + reviewAlerts + getUpcomingReviews/getOverdueDocuments (v3.26) |
| `src/hooks/useDocumentsByCategory.js` | Hook por categoria com filtros |
| `src/hooks/useDocumentActions.js` | Hook para CRUD com feedback toast |
| `src/hooks/useComplianceMetrics.js` | Score Qmentum ponderado, ropAdherence, reviewComplianceRate, documentCoverage (v3.26) |

### 25.3 Estrutura do Estado

```javascript
{
  documents: {
    etica: Document[],        // 11 docs
    comites: Document[],      // 27 docs
    auditorias: Document[],   // 23 docs
    relatorios: Document[],   // 12 docs
    biblioteca: Document[],   // 32 docs
    financeiro: Document[]    // 10 docs (v3.26 - completo)
  },
  counts: {
    etica: 11,
    comites: 27,
    auditorias: 23,
    relatorios: 12,
    biblioteca: 32,
    financeiro: 10,
    total: 115
  },
  isLoading: boolean,
  isInitialized: boolean,
  error: string | null,
  lastSync: Date | null
}
```

### 25.4 Uso nos Componentes

**CentroGestaoPage (Centro de Gestão):**
```jsx
import { useDocuments } from '@/hooks'

function CentroGestaoPage() {
  const { documents: documentsByCategory, isLoading } = useDocuments()

  // documents.etica, documents.comites, etc.
  // Automaticamente sincronizado com QualidadePage
}
```

**QualidadePage (Contagens nos Cards):**
```jsx
import { useDocuments } from '@/hooks'

function QualidadePage() {
  const { counts, isLoading } = useDocuments()

  return (
    <Card
      subtitle={isLoading ? 'Carregando...' : `${counts.etica || 0} documentos`}
    />
  )
}
```

### 25.5 Ações CRUD

```javascript
import { useDocumentActions } from '@/hooks'

const { addDocument, updateDocument, deleteDocument, archiveDocument, restoreDocument } = useDocumentActions()

// Adicionar documento
addDocument('etica', { titulo: 'Novo', codigo: 'ET-001' })

// Atualizar documento
updateDocument('etica', 'doc-id', { titulo: 'Atualizado' })

// Arquivar documento
archiveDocument('etica', 'doc-id')

// Restaurar documento
restoreDocument('etica', 'doc-id')

// Excluir documento
deleteDocument('etica', 'doc-id')
```

### 25.6 Queries com Filtros

```javascript
import { useDocumentsByCategory } from '@/hooks'

const { documents, isLoading, search, setSearch, filter, setFilter } = useDocumentsByCategory('auditorias')

// Filtrar por status
setFilter({ status: 'ativo' })

// Buscar por texto
setSearch('protocolo')

// documents já vem filtrado e ordenado
```

### 25.7 Categorias de Documentos

```javascript
// src/types/documents.js
export const DOCUMENT_CATEGORIES = {
  ETICA: 'etica',
  COMITES: 'comites',
  AUDITORIAS: 'auditorias',
  RELATORIOS: 'relatorios',
  BIBLIOTECA: 'biblioteca',
  FINANCEIRO: 'financeiro',
}

export const DOCUMENT_STATUS = {
  ATIVO: 'ativo',
  ARQUIVADO: 'arquivado',
  RASCUNHO: 'rascunho',
}
```

### 25.8 Integração no App

```jsx
// src/main.jsx
import { DocumentsProvider } from '@/contexts/DocumentsContext'

<DocumentsProvider>
  <EventAlertsProvider>
    <App />
  </EventAlertsProvider>
</DocumentsProvider>
```

### 25.9 Navegação para Detalhes

Ao clicar em um documento no Centro de Gestão, ele navega para a página de detalhes:

```jsx
// CentroGestaoPage.jsx
onDocAction={(action, doc) => {
  if (action === 'view' && doc) {
    onNavigate?.('documento-detalhe', {
      documentoId: doc.id,
      returnTo: 'centro-gestao',
    })
  }
}}
```

---

## 26. MÓDULO DE EDUCAÇÃO (ADMIN)

### 26.1 Estrutura de Arquivos

```
src/pages/educacao/
├── admin/
│   ├── AdminConteudoPage.jsx   # Gestão de conteúdo (layout 3 painéis)
│   ├── AdminAulasPage.jsx      # Página admin de aulas
│   ├── AdminTrilhasPage.jsx    # Página admin de trilhas
│   ├── CursoFormModal.jsx      # Modal criar/editar treinamentos
│   ├── TrilhaFormModal.jsx     # Modal criar/editar trilhas
│   ├── ModuloFormModal.jsx     # Modal criar/editar módulos
│   ├── AulaFormModal.jsx       # Modal criar/editar aulas
│   ├── RelatoriosEducacaoPage.jsx # Relatórios e analytics
│   ├── index.js                # Exports centralizados
│   └── components/
│       ├── CascadeCreator.jsx      # Criação guiada em cascata (refatorado v3.22)
│       ├── StepTrilha.jsx          # Step 1: Trilha (visibilidade auto)
│       ├── StepTreinamento.jsx     # Step 2: Treinamento (herda trilha)
│       ├── StepModulo.jsx          # Step 3: Módulo (herda treinamento)
│       ├── StepAula.jsx            # Step 4: Aula (campos por tipo) ← REFATORADO
│       ├── CascadeSummary.jsx      # Resumo lateral
│       ├── ContinueSessionDialog.jsx # Diálogo continuar sessão
│       ├── EntitySelector.jsx      # Seletor de entidades existentes
│       ├── NovoConteudoModal.jsx   # Modal global de criação
│       ├── ReorderableList.jsx     # Lista reordenável
│       ├── ContentPreviewInline.jsx # Preview inline do conteúdo ← NOVO
│       ├── BannerUpload.jsx        # Upload de banner/thumbnail ← NOVO
│       ├── PublishButton.jsx       # Botão publicar com validação ← NOVO
│       ├── SyncStatusPanel.jsx     # Painel status publicação ← NOVO
│       ├── TreeNavigator.jsx       # Árvore navegável c/ expand ← NOVO
│       ├── TreeBreadcrumb.jsx      # Breadcrumb hierárquico ← NOVO
│       ├── PanelShell.jsx          # Container painel c/ scroll ← NOVO
│       ├── PreviewModal.jsx        # Preview student-safe ← NOVO
│       ├── CursosTab.jsx           # Aba de gerenciamento de cursos
│       ├── TrilhasTab.jsx          # Aba de gerenciamento de trilhas
│       ├── ModulosTab.jsx          # Aba de gerenciamento de módulos
│       ├── AulasTab.jsx            # Aba de gerenciamento de aulas
│       ├── StatCard.jsx            # Card de estatísticas
│       └── index.js                # Exports
├── components/
│   ├── TrilhaBanner.jsx        # Banner com herança de imagens ← NOVO
│   ├── CursoCard.jsx           # Card de treinamento
│   ├── TrilhaCard.jsx          # Card de trilha
│   ├── AulaPlayer.jsx          # Player de aulas
│   ├── ContentTree.jsx         # Árvore de conteúdo
│   ├── StatusBadge.jsx         # Badge de status
│   ├── QuickAddForm.jsx        # Formulário rápido de adição
│   ├── CursoFiltros.jsx        # Filtros de treinamentos
│   ├── TrilhaFiltros.jsx       # Filtros de trilhas
│   ├── ConteudoItem.jsx        # Item de conteúdo
│   ├── CertificadoItem.jsx     # Item de certificado
│   ├── PontosItem.jsx          # Item de pontos
│   └── index.js
├── hooks/
│   ├── useEducacaoData.js      # Hook centralizado CRUD (+ forceRefreshFromFirestore)
│   ├── useProgressoUsuario.js  # Progresso do usuário
│   ├── useVisibilityCheck.js   # Verificação de visibilidade
│   ├── useEffectiveBanner.js   # Banner com fallback ancestry
│   └── index.js
├── utils/
│   ├── visibilityUtils.js      # Cálculo de visibilidade (INHERIT/PUBLIC/RESTRICTED) ← NOVO
│   └── certificateGenerator.js # Geração de certificados
├── data/
│   └── mockEducacaoData.js     # Dados mock (cursos, trilhas, módulos, aulas)
├── EducacaoPage.jsx            # Página principal de Educação
├── EducacaoContinuadaPage.jsx  # Dashboard de Educação Continuada
├── TrilhaDetalhePage.jsx       # Detalhe de trilha
├── CursoDetalhePage.jsx        # Detalhe de treinamento
├── AulaPlayerPage.jsx          # Player de aula fullpage
├── CertificadosPage.jsx        # Certificados do usuário
├── PontosPage.jsx              # Sistema de pontos
└── index.js                    # Exports
```

### 26.2 Terminologia Atualizada

**IMPORTANTE:** A nomenclatura foi padronizada:

| Antigo | Novo | Contexto |
|--------|------|----------|
| Curso | Treinamento | UI visível ao usuário |
| `curso` | `curso` | Código/variáveis (mantido para compatibilidade) |
| Cursos (dados) | Treinamentos | Labels, títulos |

Internamente o código usa `curso` (cursos, cursoId, etc.), mas a interface exibe "Treinamento".

### 26.3 AdminConteudoPage - Layout 3 Painéis

Nova página principal de gestão com layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Header (fixo via portal)                                    │
├──────────┬──────────────────────────┬───────────────────────┤
│ Navigator│        Editor            │      Sidebar          │
│ (Árvore) │  (Formulário/Preview)    │  (Status/Links)       │
│          │                          │                       │
│ Trilha   │  Título: [___________]   │  Status: Publicado    │
│  ├─Curso │  Descrição:              │  Criado: 28/01/2026   │
│  │ ├─Mod │  [________________]      │  Atualizado: hoje     │
│  │ │ └─Au│                          │  Aulas: 12            │
│  │ └─Mod │  Conteúdo                │                       │
│  └─Curso │  [Editor de blocos]      │  Links rápidos:       │
│          │                          │  • Visualizar         │
│          │                          │  • Duplicar           │
└──────────┴──────────────────────────┴───────────────────────┘
```

**Features:**
- Navegação em árvore hierárquica (Trilha → Treinamento → Módulo → Aula)
- Editor contextual baseado no tipo selecionado
- Sidebar com metadados e ações rápidas
- Sistema de blocos para aulas (texto, vídeo, áudio, quiz)
- ReorderableList para drag & drop

### 26.4 CascadeCreator - Criação Guiada

Sistema de wizard para criação de conteúdo em cascata:

**Fluxo:** Trilha → Treinamento → Módulo → Aula

```jsx
<CascadeCreator onNavigate={handleNavigate} />
```

**Componentes de Steps:**
- `StepTrilha` - Criar nova ou anexar trilha existente
- `StepTreinamento` - Criar novo ou anexar treinamento existente
- `StepModulo` - Criar novo ou anexar módulo existente
- `StepAula` - Criar aula com upload de mídia

**Features:**
- **EntitySelector** - Permite anexar entidades existentes em vez de criar novas
- **CascadeSummary** - Resumo lateral (desktop) ou accordion (mobile)
- **ContinueSessionDialog** - Recupera sessão interrompida do localStorage
- **Persistência** - Sessão salva automaticamente (`STORAGE_KEY = 'cascade_session'`)
- **Status Draft/Published** - Entidades criadas com status DRAFT por padrão

### 26.5 Sistema de Visibilidade

Modelo de controle de acesso hierárquico:

| Modo | Comportamento |
|------|---------------|
| `INHERIT` | Herda do pai (default para filhos) |
| `PUBLIC` | Visível para todos os usuários autenticados |
| `RESTRICTED` | Visível apenas para `allowedUserTypes` específicos |

**visibilityUtils.js:**
```javascript
import { computeEffectiveVisibility, canUserAccess } from './utils/visibilityUtils';

// Calcular visibilidade percorrendo ancestry
const { effectiveVisibility, effectiveAllowedUserTypes } =
  computeEffectiveVisibility(aula, [modulo, curso, trilha]);

// Verificar acesso
const hasAccess = canUserAccess(entity, userType);
```

**useVisibilityCheck.js:**
```javascript
const { canAccess, effectiveVisibility } = useVisibilityCheck(entity, ancestry);
```

**Regras de Herança:**
1. Se entidade tem modo explícito (PUBLIC/RESTRICTED), usa esse modo
2. Se INHERIT, percorre pais até encontrar modo explícito
3. Se toda cadeia é INHERIT, assume PUBLIC

### 26.6 useEducacaoData - Hook Centralizado

Hook principal para CRUD de dados educacionais:

```javascript
const {
  // Dados
  trilhas, cursos, modulos, aulas,
  loading, error,

  // CRUD Trilhas
  addTrilha, updateTrilha, deleteTrilha,

  // CRUD Treinamentos
  addCurso, updateCurso, deleteCurso,

  // CRUD Módulos
  addModulo, updateModulo, deleteModulo,

  // CRUD Aulas
  addAula, updateAula, deleteAula,

  // Relações
  trilhaCursosRel, cursoModulosRel, moduloAulasRel,
  getModulosByCursoId, getAulasByModuloId,

  // Utilitários
  getCursosByTrilha, buildContentTree, refreshData,
} = useEducacaoData({ useMock: false, autoFetch: true });
```

**Integração Firebase:**
- Usa `educacaoService` para operações Firestore
- Fallback automático para mock data (`VITE_USE_MOCK=true`)
- Sanitização de dados para evitar referências órfãs

### 26.7 TrilhaBanner e useEffectiveBanner

Sistema de banner com herança de imagens:

```jsx
// Aula herda banner do módulo, que herda do curso, que herda da trilha
<TrilhaBanner
  entity={aula}
  ancestry={[modulo, curso, trilha]}
/>
```

**useEffectiveBanner:**
```javascript
const { bannerUrl, sourceLevel } = useEffectiveBanner(entity, ancestry);
// sourceLevel: 'self' | 'modulo' | 'curso' | 'trilha' | 'default'
```

### 26.8 Componentes de Formulário (Admin)

#### CursoFormModal

Modal para criar/editar cursos com:
- Upload de banner via `uploadService.uploadBanner()`
- Seleção de categoria via Select
- Vinculação a múltiplas trilhas via checkboxes
- Campos: título, descrição, duração, meta de conclusão, obrigatório, ativo

```jsx
<CursoFormModal
  open={showModal}
  onClose={() => setShowModal(false)}
  onSave={handleSaveCurso}
  curso={selectedCurso}           // null para criação
  trilhas={trilhas}               // Lista de trilhas disponíveis
  onTrilhasUpdate={handleTrilhasUpdate}
/>
```

#### TrilhaFormModal

Modal para criar/editar trilhas com:
- Reordenação de cursos via drag & drop
- Criação de curso inline (abre CursoFormModal aninhado)

```jsx
<TrilhaFormModal
  open={showModal}
  onClose={() => setShowModal(false)}
  onSave={handleSaveTrilha}
  trilha={selectedTrilha}
  cursos={cursos}
  trilhas={trilhas}               // IMPORTANTE: necessário para CursoFormModal aninhado
  onCursoCreated={handleCursoCreated}
/>
```

#### AulaFormModal

Modal para criar/editar aulas com:
- Upload de vídeo/áudio via `uploadService.uploadVideo()` ou `uploadService.uploadAudio()`
- Tipos: video, audio, texto, quiz
- Vinculação a módulo/curso

### 26.9 Upload Service

Localização: `src/services/uploadService.js`

#### Métodos Principais

```javascript
// Upload de banner (imagem)
const url = await uploadService.uploadBanner(file, entityId, onProgress);

// Upload de vídeo
const result = await uploadService.uploadVideo(file, entityId, onProgress);

// Upload de áudio
const result = await uploadService.uploadAudio(file, entityId, onProgress);

// Upload genérico
const result = await uploadService.upload(file, type, entityId, onProgress, useMock);
```

#### Mock Upload (Desenvolvimento)

Em modo de desenvolvimento (`import.meta.env.DEV`) sem usuário autenticado, o uploadService usa mock automático:

```javascript
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

const shouldUseMock = () => {
  return isDevelopment && !auth.currentUser;
};
```

O mock simula upload com progresso e retorna URL de placeholder.

### 26.10 FileUpload - Props Corretas

O componente `FileUpload` do design-system aceita:

```jsx
<FileUpload
  accept="image/*"              // Tipos aceitos
  onChange={handleUpload}       // ✅ CORRETO (não onFileSelect!)
  maxSize={10 * 1024 * 1024}    // Tamanho máximo em bytes
  disabled={isUploading}        // Desabilitar durante upload
  error={errors.field}          // Mensagem de erro
  variant="dropzone"            // "dropzone" (grande, drag-and-drop) ou "button" (compacto)
  value={file}                  // File ou File[] - ativa FilePreview built-in
  multiple={false}              // Upload múltiplo (value deve ser array)
  label="Arquivo *"             // Label acima do campo
  description="Selecione..."    // Texto auxiliar
/>
```

**Props INCORRETAS (não usar):**
- ❌ `onFileSelect` → usar `onChange`
- ❌ `uploading` → usar `disabled`
- ❌ `progress` → usar componente `Progress` separado

**Variantes:**
- `variant="dropzone"` (padrão): Área grande com drag-and-drop, ideal para páginas com espaço
- `variant="button"`: Botão compacto com nome do arquivo ao lado, ideal para modais

**FilePreview built-in:** Quando `value` é passado, o componente renderiza automaticamente preview com nome, tamanho e botão remover. Não criar preview custom duplicado.

**Cores:** Zero cores hardcoded. Usa tokens DS: `text-primary`, `bg-card`, `bg-secondary`, `bg-accent`, `border-border`, `focus:ring-ring/30`, `text-destructive`.

**Padrão de progresso:**
```jsx
{isUploading && (
  <div className="mt-2 flex items-center gap-2">
    <Progress value={uploadProgress} className="flex-1" />
    <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
  </div>
)}
```

### 26.11 Select com Portal (Modais)

O componente `Select` usa `createPortal` para renderizar dropdown fora do overflow do modal:

```jsx
// src/design-system/components/ui/select.jsx

// Portal para body com z-index alto
{isOpen && portalTarget && createPortal(
  <motion.div
    ref={dropdownRef}
    style={{
      position: "fixed",
      top: dropdownPos.top,
      left: dropdownPos.left,
      width: dropdownPos.width,
      zIndex: 1300,  // Acima do modal (1100)
    }}
  >
    {/* opções */}
  </motion.div>,
  portalTarget
)}
```

**Click outside handler** deve considerar portal:
```javascript
const handleClickOutside = (e) => {
  if (containerRef.current?.contains(e.target)) return;
  if (dropdownRef.current?.contains(e.target)) return;  // Portal!
  setIsOpen(false);
};
```

### 26.12 FormField e Fragments

**IMPORTANTE:** `FormField` passa props para children. React.Fragment (`<>`) não aceita props.

```jsx
// ❌ ERRADO - causa erro "Invalid prop 'aria-describedby' on React.Fragment"
<FormField label="Banner">
  <>
    <FileUpload ... />
    <Progress ... />
  </>
</FormField>

// ✅ CORRETO - usar div
<FormField label="Banner">
  <div>
    <FileUpload ... />
    <Progress ... />
  </div>
</FormField>
```

### 26.13 Bugs Comuns e Soluções

| Bug | Causa | Solução |
|-----|-------|---------|
| Trilhas vazias em CursoFormModal | TrilhaFormModal não passa `trilhas` prop | Adicionar `trilhas={trilhas}` |
| Banner não faz upload | Prop `onFileSelect` não existe | Usar `onChange` |
| Modal fica em branco | `aria-describedby` em Fragment | Trocar `<>` por `<div>` |
| Select fecha ao clicar | Click outside não considera portal | Verificar `dropdownRef` |
| Upload falha em dev | Firebase requer autenticação | uploadService usa mock automático |

### 26.14 Z-Index Hierarchy

| Componente | Z-Index |
|------------|---------|
| Modal Overlay | 1100 |
| Dropdown | 1200 |
| Select Portal | 1300 |
| Toast | 1400 |

### 26.15 TIPOS_USUARIO - Normalização e Compatibilidade

**IMPORTANTE:** `TIPOS_USUARIO` em `educacaoService.js` foi alinhado com o SSOT de role keys:

```javascript
// src/services/educacaoService.js
export const TIPOS_USUARIO = {
  anestesiologista: { label: 'Anestesiologista', color: '#2563eb' },
  'medico-residente': { label: 'Médico Residente', color: '#8b5cf6' },
  enfermeiro: { label: 'Enfermeiro', color: '#10b981' },
  'tec-enfermagem': { label: 'Téc. Enfermagem', color: '#06b6d4' },
  farmaceutico: { label: 'Farmacêutico', color: '#ec4899' },
  colaborador: { label: 'Colaborador', color: '#6366f1' },
  coordenador: { label: 'Coordenador', color: '#16a085' },
  secretaria: { label: 'Secretária', color: '#f59e0b' },
};
```

**Aliases para dados antigos:**
```javascript
const USER_TYPE_ALIASES = {
  medico: 'anestesiologista',
  residente: 'medico-residente',
  tecnico_enfermagem: 'tec-enfermagem',
  administrativo: 'colaborador',
};
```

**Funções de normalização:**
```javascript
import { normalizeUserType, normalizeUserTypes } from '@/services/educacaoService';

normalizeUserType('medico');        // → 'anestesiologista'
normalizeUserType('tecnico_enfermagem'); // → 'tec-enfermagem'
normalizeUserTypes(['medico', 'residente']); // → ['anestesiologista', 'medico-residente']
```

As queries `getVisibleEntities` e `canAccessByVisibility` agora normalizam o `userType` automaticamente.

### 26.16 Student-Safe Queries (SEM Junction Tables)

Novas funções para consultar conteúdo do ponto de vista do aluno. Usam arrays denormalizados (`publishedCursoIds`, `publishedModuloIds`, `publishedAulaIds`) em vez de junction tables.

```javascript
import {
  getTrilhasForStudent,
  getCursosForStudent,
  getModulosForStudent,
  getAulasForStudent,
  getConteudoCompletoForStudent,
  getTrilhaCompletoForStudent,
} from '@/services/educacaoService';

// Buscar trilhas visíveis para um tipo de usuário
const trilhas = await getTrilhasForStudent('anestesiologista');

// Buscar cursos de uma trilha (usa publishedCursoIds)
const cursos = await getCursosForStudent(trilhaId, 'enfermeiro');

// Buscar módulos de um curso (usa publishedModuloIds)
const modulos = await getModulosForStudent(cursoId, userType);

// Buscar aulas de um módulo (usa publishedAulaIds)
const aulas = await getAulasForStudent(moduloId, userType);

// Árvore completa (trilhas → cursos → módulos → aulas)
const tree = await getConteudoCompletoForStudent(userType);

// Trilha específica com todo conteúdo
const trilhaCompleta = await getTrilhaCompletoForStudent(trilhaId, userType);
```

**Regras de filtragem:**
1. Apenas `status === 'PUBLISHED'` e `ativo === true`
2. Visibilidade: `PUBLIC` (todos) ou `RESTRICTED` + `userType` na lista
3. Chunking automático para queries Firestore (max 10 IDs por `in`)
4. Resultado reordenado conforme array original

**Helper interno:** `fetchByIdsInOrder(collection, ids, userType)` - busca documentos por IDs com chunking e reordenação.

### 26.17 Visibilidade Simplificada no CascadeCreator

**v3.22 simplificou a seleção de visibilidade nos Steps:**

| Step | Antes (v3.21) | Depois (v3.22) |
|------|---------------|----------------|
| **StepTrilha** | Seletor manual PUBLIC/RESTRICTED + allowedUserTypes | Auto: `tiposUsuario.length > 0` → RESTRICTED, senão → PUBLIC |
| **StepTreinamento** | Seletor manual INHERIT/PUBLIC/RESTRICTED | Sempre INHERIT (herda da trilha automaticamente) |
| **StepModulo** | Seletor manual INHERIT/PUBLIC/RESTRICTED | Sempre INHERIT (herda do treinamento) |
| **StepAula** | Seletor manual INHERIT/PUBLIC/RESTRICTED | Sempre INHERIT (herda do módulo) |

**Regra:** Apenas a Trilha define a visibilidade. Filhos herdam automaticamente (cascata).

### 26.18 StepAula - Campos por Tipo de Conteúdo

O `StepAula` agora possui campos específicos para cada tipo de conteúdo:

| Tipo | Campos | Validação |
|------|--------|-----------|
| `text` | conteudo (textarea) | Título obrigatório |
| `youtube` | url (input URL) | Título + URL obrigatórios |
| `vimeo` | url (input URL) | Título + URL obrigatórios |
| `video` | arquivo (file upload) | Título + arquivo obrigatórios |
| `audio` | arquivo (file upload) | Título + arquivo obrigatórios |
| `document` | arquivo (file upload) | Título + arquivo obrigatórios |

**Bloco inicial por tipo:**
```javascript
// YouTube/Vimeo: { url, title }
// Video/Audio/Document: { url: '', fileName, fileSize, fileType, title, pendingUpload: true }
// Text: { html: '<p>...</p>' }
```

**ContentPreviewInline** é exibido abaixo do formulário mostrando preview do conteúdo em tempo real.

### 26.19 Novos Componentes Admin (v3.22)

#### ContentPreviewInline
Preview inline do conteúdo da aula durante criação:
- YouTube: embed iframe com thumbnail (clique para ativar)
- Vimeo: embed iframe
- Video: `<video>` HTML5 com controles
- Audio: `<audio>` HTML5 com controles
- Document/PDF: iframe preview ou mensagem de tipo
- Expansão fullscreen via portal

```jsx
<ContentPreviewInline formData={{ titulo, tipo, url, arquivo, conteudo }} />
```

#### BannerUpload
Upload de banner/thumbnail reutilizável:
```jsx
<BannerUpload
  value={bannerUrl}
  onChange={(newUrl) => setBannerUrl(newUrl)}
  entityId={entityId}
  entityType="trilha"  // 'trilha' | 'curso' | 'modulo' | 'aula'
  aspectRatio={16/9}
  label="Banner (opcional)"
/>
```

#### PublishButton
Botão de publicação com validação de hierarquia:
- Valida pré-requisitos (título, conteúdo, filhos)
- Preview do que será visível
- Opção de cascata (publicar filhos junto)
- Feedback visual do status

```jsx
<PublishButton
  entity={selectedEntity}
  entityType="trilha"
  context={{ cursos, modulos, aulas }}
  onPublish={handlePublish}
/>
```

#### SyncStatusPanel
Painel de estatísticas de publicação:
- Contadores: total/publicados/rascunhos por tipo
- Barra de progresso por entidade
- Botão de forçar sincronização
- Alertas de itens pendentes

```jsx
<SyncStatusPanel
  trilhas={trilhas}
  cursos={cursos}
  modulos={modulos}
  aulas={aulas}
  onSync={handleSync}
/>
```

#### TreeNavigator + useTreeExpansion
Navegação hierárquica em árvore com visual flat (padrão NavLink/SidebarItem):
- Rows sem border/bg — integram com card pai (file-explorer pattern)
- Selected: `bg-[#D4EDDA] dark:bg-[rgba(46,204,113,0.15)]` (DS green)
- Hover: `hover:bg-muted/60`, transition: `transition-colors duration-150`
- Connector lines 1px com `bg-border/40` (sutis)
- Expand/collapse com animação
- Navegação por teclado (ArrowUp/Down/Left/Right, Enter, Space, Home, End)
- Badge de contagem de filhos
- Scroll automático ao selecionar

```jsx
const { isExpanded, toggle, expandAll, collapseAll } = useTreeExpansion();

<TreeNavigator
  items={contentTree}
  selectedKey={selectedKey}
  onSelect={handleSelect}
  isExpanded={isExpanded}
  onToggle={toggle}
/>
```

#### TreeBreadcrumb
Breadcrumb hierárquico para navegação:
```jsx
<TreeBreadcrumb
  items={contentTree}
  selectedKey={selectedKey}
  onNavigate={handleSelect}
/>
```

#### PanelShell
Container padrão para painéis com scroll controlado:
```jsx
<PanelShell
  header={<h3>Título do Painel</h3>}
  footer={<Button>Ação</Button>}
>
  {/* Conteúdo scrollável */}
</PanelShell>
```

#### PreviewModal (Student-Safe)
Preview que usa as mesmas queries do aluno:
- Seleciona tipo de usuário para simular
- Mostra itens visíveis com layout real
- Itens ocultos (draft, inativos, sem permissão) aparecem com motivo
- Comparação admin vs aluno

```jsx
<PreviewModal
  open={showPreview}
  onClose={() => setShowPreview(false)}
  trilhas={trilhas}
  cursos={cursos}
  modulos={modulos}
  aulas={aulas}
/>
```

### 26.20 AdminConteudoPage - Melhorias v3.22

**BlockRenderer aprimorado:**
- YouTube: embed inline via iframe (`youtube.com/embed/{id}`)
- Vimeo: embed inline via iframe (`player.vimeo.com/video/{id}`)
- Video: `<video>` nativo com `controls`
- Audio: `<audio>` nativo com `controls`
- Document/PDF: `<iframe>` para PDFs, mensagem para outros tipos
- Estados de upload pendente (`pendingUpload: true`)

**RichTextSimple refatorado:**
- Usa `useRef` em vez de estado interno (corrige bug de posição do cursor)
- `dangerouslySetInnerHTML` apenas no render inicial
- `onInput` sincroniza via `ref.current.innerHTML`

**Novos imports:**
- `TreeNavigator`, `useTreeExpansion` - navegação em árvore
- `TreeBreadcrumb` - breadcrumb hierárquico
- `SyncStatusPanel` - painel de sincronização

### 26.21 CascadeCreator - Melhorias v3.22

**Alterações comportamentais:**
- Breakpoint mobile: `1024px` → `768px` (alinhado com Tailwind `md:`)
- Novo prop `onComplete` - callback ao finalizar toda a cascata
- Inicialização: `currentStep` começa `null`, setado após verificar sessão
- Estado `isInitialized` previne salvamento prematuro no localStorage
- Recuperação de sessão: só mostra dialog se houver progresso real (não apenas step 'trilha' vazio)
- Finalização automática na última etapa (aula)
- Limpeza do localStorage antes do setState na última etapa (evita race condition)
- Cleanup no unmount quando `currentStep === 'done'`

### 26.23 Navigator Card — Visual Overhaul + Toolbar Fix

**Data:** 06/02/2026

#### TreeNavigator.jsx — Restyling para padrão NavLink/SidebarItem

TreeRow rows removem visual de "card individual" e seguem padrão flat do DS (NavLink + SidebarItem):

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Row styling** | `rounded-xl border bg-card` (card individual) | `rounded-xl` sem border/bg (flat, integra com card pai) |
| **Selected state** | `bg-primary/10 border-primary shadow-sm` | `bg-[#D4EDDA] dark:bg-[rgba(46,204,113,0.15)]` (DS green) |
| **Hover** | `hover:bg-muted/50 hover:border-primary/30` | `hover:bg-muted/60` (NavLink pattern) |
| **Transition** | `transition-all duration-200` | `transition-colors duration-150` (NavLink pattern) |
| **Selected text** | `text-primary` | `text-[#004225] dark:text-[#2ECC71]` (DS green) |
| **Connector lines** | `w-[2px] bg-border` | `w-px bg-border/40` (mais sutis) |
| **Container spacing** | `space-y-1` | `space-y-0.5` (mais compacto) |
| **Dot placeholder** | `h-5 w-5` opacity 40% | `h-4 w-4` opacity 30% |
| **Padding** | `py-2.5` | `py-2` |

**Zero impacto funcional:** Apenas className alterados. ARIA, keyboard nav, expand/collapse, seleção — tudo intacto.

#### AdminConteudoPage.jsx — Toolbar layout fix

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Search** | Dividido com botão Filtro (`flex items-center gap-2`) | Full-width em linha própria |
| **Toolbar** | `flex flex-wrap gap-1.5` (2 variantes misturadas) | `grid grid-cols-4 gap-1` (4 colunas iguais) |
| **Botões** | Mistura `ghost` + `outline`, tamanhos desiguais | Todos `ghost`, `text-xs px-1`, `w-full` (simétricos) |
| **Labels** | "Expandir todos", "Colapsar todos" | "Expandir", "Colapsar" (mais compactos) |
| **Container gap** | `gap-2` | `gap-1.5` |
| **Tree margin** | `mt-3` | `mt-2` |

#### StepTrilha.jsx — Grid de Tipos de Usuário

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Grid rows** | Alturas desiguais (texto wrap inconsistente) | `auto-rows-[1fr]` (todas as linhas mesma altura) |
| **Alignment** | `items-start` | `items-center` (checkbox+label centralizados) |
| **Border radius** | `rounded-lg` | `rounded-xl` (DS pattern) |
| **Hover** | `hover:bg-muted` | `hover:bg-muted/60` (NavLink pattern) |
| **Font mobile** | `text-sm` (causa wrap) | `text-xs sm:text-sm` (reduz wrap em 2-col) |
| **Grid cols** | `grid-cols-2 sm:grid-cols-3` | `grid-cols-2 sm:grid-cols-4` (8 itens em 2 rows desktop) |

#### CascadeCreator.jsx — Stepper simétrico

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Icon containers** | `flex-1` (estica desigualmente) | Sem flex-1 (tamanho natural) |
| **Connectors** | `flex-1` (larguras variáveis) | `w-10 sm:w-14` (largura fixa, iguais) |
| **Alignment** | `justify-between` (espalha) | `justify-center` (agrupado no centro) |
| **Icons** | Sem shrink-0 | `shrink-0` (circular perfeito) |

**Arquivos alterados:**
- `src/pages/educacao/admin/components/TreeNavigator.jsx`
- `src/pages/educacao/admin/AdminConteudoPage.jsx`
- `src/pages/educacao/admin/components/StepTrilha.jsx`
- `src/pages/educacao/admin/components/CascadeCreator.jsx`

### 26.24 EducacaoContinuadaPage — Visual Overhaul

**Data:** 06/02/2026

#### Search bar — DS SearchBar

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Componente** | `Card > CardContent > Input` (box dentro de box) | `SearchBar` do DS (idêntico à HomePage) |
| **Visual** | Input genérico dentro de card com padding extra | Ícone de busca verde, borda `#A5D6A7`, focus `#006837`, dark mode completo |
| **Import** | `Input` | `SearchBar` (adicionado ao import do DS) |

```jsx
<SearchBar
  value={filtros.busca}
  onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
  placeholder="Buscar treinamentos..."
  className="mb-0"
/>
```

#### Filter buttons — Ambas as tabs

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Variant** | `Button` default (filled green, grande) | `Button size="sm" variant="outline"` (compacto, outline) |
| **Texto** | `FILTRAR CURSOS` / `FILTRAR TRILHAS` (uppercase) | `Filtrar cursos` / `Filtrar trilhas` (sentence case) |
| **Ícone** | `w-5 h-5` | `w-4 h-4` (proporcional) |
| **Wrapper** | `<div className="flex justify-start">` | Sem wrapper (desnecessário) |

**Arquivo:** `src/pages/educacao/EducacaoContinuadaPage.jsx`

### 26.22 useEducacaoData - forceRefreshFromFirestore

Novo método para forçar atualização dos dados direto do Firestore, ignorando o modo mock:

```javascript
const { forceRefreshFromFirestore } = useEducacaoData();

// Útil após publicação, sincronização, etc.
await forceRefreshFromFirestore();
```

---

## 27. SISTEMA DE COMUNICAÇÃO (MENSAGENS & NOTIFICAÇÕES)

### 27.1 Visão Geral

Sistema de caixa de mensagens com estilo iOS Mail. Inclui mensagens privadas entre usuários, notificações do sistema por categoria, e rastreamento de denúncias anônimas.

### 27.2 Arquivos do Sistema

#### Páginas
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/communication/InboxPage.jsx` | Caixa de entrada com 4 tabs (Todas, Mensagens, Notificações, Rastrear) |
| `src/pages/communication/MessageDetailPage.jsx` | Detalhe de mensagem/notificação com reply, archive, mark unread, delete |

#### Componentes DS (`src/design-system/components/communication/`)
| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `MessageCard` | message-card.jsx | Card de mensagem privada com avatar, prioridade, anexos |
| `NotificationCard` | notification-card.jsx | Card de notificação com ícone de categoria colorido |
| `MessageList` | message-list.jsx | Lista de mensagens com busca e filtros (Todas, Não lidas, Enviadas, Arquivadas) |
| `InboxSection` | inbox-section.jsx | Wrapper SectionCard para caixa de entrada |
| `InboxWidget` | inbox-section.jsx | Versão compacta para dashboard/widgets |

#### Context
| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/MessagesContext.jsx` | Provider com mock data (Firebase-ready), gerencia mensagens (markAsRead, markAsUnread, archive), notificações e categorias |

### 27.3 Tokens DS Utilizados (Regra de Cores)

**REGRA:** Todos os componentes de comunicação usam exclusivamente tokens semânticos do DS. Cores hex hardcoded foram removidas.

| Elemento | Token DS | Descrição |
|----------|----------|-----------|
| Card background | `bg-card` | Fundo de cards (message-card, notification-card) |
| Texto principal | `text-foreground` | Nomes, assuntos |
| Texto secundário | `text-muted-foreground` | Roles, timestamps, previews |
| Bordas padrão | `border-border` | Prioridade normal |
| Borda alta | `border-warning/30` | Prioridade alta |
| Borda urgente | `border-destructive/30` | Prioridade urgente |
| Indicador não lido | `bg-primary` / `border-l-primary` | Dot e borda esquerda |
| Card selecionado | `ring-primary` | Ring no message-card |
| Avatar ring | `ring-card` | Anel ao redor do avatar |
| Badge não lidas | `bg-primary text-primary-foreground` | Contador em message-list |
| Botão hover | `hover:bg-muted` | Dismiss em notification-card |
| Botão ação (detail) | `bg-primary` (Button padrão) | Botão "Ver Escala" etc. no MessageDetailPage |
| Botão excluir | `text-destructive border-destructive/30` | Botão de excluir |
| Badge warning | `bg-warning` | Prioridade "Alta" no compose |

### 27.4 Cores Dinâmicas de Categoria (Exceção)

O `NotificationCard` usa um sistema de cores dinâmicas por categoria via CSS custom property `--notif-color`. **Essas cores são intencionais e NÃO devem ser substituídas por tokens DS.**

```jsx
// notification-card.jsx - CSS custom property para cores de categoria
<style>{`
  [data-slot="notification-card"][data-category="${category}"] {
    --notif-color: ${colorLight};
  }
  .dark [data-slot="notification-card"][data-category="${category}"] {
    --notif-color: ${colorDark};
  }
`}</style>
```

**Elementos que usam `--notif-color`:**
- Círculo do ícone de categoria (background + ícone)
- Borda esquerda de notificações não lidas
- Texto do botão de ação (ghost) no card da lista

**No MessageDetailPage**, apenas o ícone de categoria e o badge de categoria usam `catColor`. Botões de ação usam `bg-primary` (DS padrão).

### 27.5 InboxPage - Layout iOS Mail

A InboxPage usa layout flat estilo iOS Mail com o componente `MailRow`:
- Dot de não lido (10px, `bg-primary`)
- 3 linhas: Sender + Categoria + Hora, Subject, Preview
- Divider fino (`bg-border`)
- Tabs com ícones animados (pills): Todas, Mensagens, Notificações, Rastrear
- Tabs usam `data-[state=active]:flex-[3]` para dar espaço suficiente ao texto do tab ativo (ex: "Notificacoes" com 12 chars)

**Header:**
- Ícone `ListFilter` (3 traços) no canto superior direito para filtrar apenas mensagens não lidas (`showUnreadOnly`)
- Ícone fica verde (`text-primary`) quando filtro ativo, cinza (`text-muted-foreground`) quando inativo

**Tab Mensagens:**
- Lista de mensagens da inbox (não arquivadas)
- Seção colapsável "Arquivadas (N)" com `Archive` icon — expande/recolhe via `showArchived` state
- Mensagens arquivadas renderizadas com `opacity-70` para diferenciação visual

**Tabs especiais:**
- **Notificações**: chips de filtro por categoria com cores dinâmicas (`isDark ? cat.colorDark : cat.colorLight`)
- **Rastrear**: formulário de rastreamento de denúncias anônimas

### 27.6 MessageDetailPage - Estrutura

| Seção | Visibilidade | Descrição |
|-------|-------------|-----------|
| Subject + Priority Badge | Sempre | Badge `destructive` ou `warning` |
| Sender Card | Sempre | Avatar (mensagens) ou ícone categoria (notificações) |
| Content Card | Sempre | Corpo da mensagem/notificação |
| Attachments Card | Mensagens com anexos | Lista de arquivos com ícone e tamanho |
| Action Button | Notificações com action | Botão `bg-primary` (DS padrão) |
| Thread Messages | Mensagens com thread | Conversa com múltiplas mensagens |
| Reply Compose | Mensagens (toggle) | Textarea + Enviar |
| Action Buttons | Sempre | Responder, Arquivar, Nao lida (Mail icon), Excluir |

### 27.7 MessagesContext - Categorias de Notificação

```javascript
NOTIFICATION_CATEGORIES = {
  plantao:     { label: "Plantão",      colorLight: "#006837", colorDark: "#2ECC71" },
  comunicado:  { label: "Comunicado",   colorLight: "#2563EB", colorDark: "#60A5FA" },
  educacao:    { label: "Educação",     colorLight: "#7C3AED", colorDark: "#A78BFA" },
  incidente:   { label: "Incidente",    colorLight: "#DC2626", colorDark: "#EF4444" },
  qualidade:   { label: "Qualidade",    colorLight: "#059669", colorDark: "#34D399" },
  documento:   { label: "Documento",    colorLight: "#D97706", colorDark: "#FBBF24" },
  sistema:     { label: "Sistema",      colorLight: "#6366F1", colorDark: "#818CF8" },
  reuniao:     { label: "Reunião",      colorLight: "#0891B2", colorDark: "#22D3EE" },
  faturamento: { label: "Faturamento",  colorLight: "#BE185D", colorDark: "#F472B6" },
  rops:        { label: "ROPs",         colorLight: "#EA580C", colorDark: "#FB923C" },
}
```

### 27.8 Notificações de Reuniões (Firestore-backed)

Diferente das notificações de categoria `reuniao` do MessagesContext (localStorage, single-user), as notificações de participantes de reuniões são **Firestore-backed** e multi-user:

| Aspecto | MessagesContext | reuniao_notifications (Firestore) |
|---------|----------------|-----------------------------------|
| Storage | localStorage | Firestore collection |
| Alcance | Usuário local | Qualquer usuário autenticado |
| Tipo | Notificação genérica | Convocação + lembretes agendados |
| Criação | `createSystemNotification()` | `reunioesService.notifyReuniaoParticipantes()` |
| Leitura | `MessagesContext` | `reunioesService.getUserNotifications(userId)` |

**Funções em `reunioesService.js`:**
- `notifyReuniaoParticipantes(reuniaoId, reuniaoData, participants, createdBy)` — cria `convocacao` + `lembrete_1d` + `lembrete_1h`
- `getUserNotifications(userId)` — notificações onde `scheduledFor <= now` e `readAt == null`
- `markNotificationRead(notificationId)` — marca como lida

**Firestore Rules:** owner-read, admin-create, owner-update (apenas `readAt`)

---

## 28. CENTRO DE GESTÃO QMENTUM - CONFORMIDADE COMPLETA (v3.26.0 → v3.43.0)

### 28.1 Visão Geral

O Centro de Gestão foi completado com conformidade total Qmentum para o ciclo documental completo: criação → aprovação → distribuição → revisão → arquivamento.

**v3.43.0 — 100% Conformidade (27 gaps resolvidos):** Após remoção de mocks e correção de 9 gaps críticos (<50%), restavam 27 gaps em 9 áreas. Todos implementados com: sincronização real-time confiável (Firestore + Supabase), error handling com feedback visual, LGPD compliance (audit logs, exportação, solicitações), e indicadores de status de conexão em todas as abas de dados ao vivo.

### 28.2 FinanceiroSection (NOVO - antes placeholder)

**Arquivo:** `src/pages/management/documents/FinanceiroSection.jsx` (400 linhas)

Seção financeira completa seguindo o padrão das outras seções (EticaSection, ComitesSection):

**6 Tipos de Documentos Financeiros:**

| Tipo | Label | Cor |
|------|-------|-----|
| `orcamento` | Orçamentos | #2E7D32 |
| `relatorio_financeiro` | Relatórios Financeiros | #1565C0 |
| `contrato` | Documentos Contratuais | #7B1FA2 |
| `auditoria_fiscal` | Auditoria Fiscal | #00838F |
| `nota_fiscal` | Notas Fiscais | #EF6C00 |
| `prestacao_contas` | Prestação de Contas | #C62828 |

**Sub-tabs:** documentos, categorias, arquivados, stats

**Componentes reutilizados:** `FilterBar`, `DocumentCard`, `StatsCard` de `management/components/`

#### 28.2.1 DocumentCard Layout Fix (v3.38.0)

**Arquivo:** `src/pages/management/components/DocumentCard.jsx`

**Problema resolvido:** Cards com títulos truncados e informações cortadas, altura irregular no grid.

**Correções aplicadas:**

1. **Layout Flex com Altura Uniforme:**
   - Card: `h-full flex flex-col` — altura 100% do grid cell
   - CardContent: `flex-1 flex flex-col` — conteúdo expande
   - Content wrapper: `flex-1 min-w-0 flex flex-col` — flex column com min-width

2. **Título com Line-Clamp:**
   - Antes: `truncate` (1 linha + ellipsis)
   - Depois: `line-clamp-2 leading-tight` (até 2 linhas)
   - Permite títulos longos como "Protocolo de Decisão Compartilhada..." serem exibidos completos

3. **Menu de Ações Reposicionado:**
   - Movido do header row com badges para ao lado do título
   - Classe `flex-shrink-0` garante que nunca encolhe

4. **Badges em Linha Separada:**
   - Vencido/Pendente agora em div própria com `flex-wrap gap-2`
   - `whitespace-nowrap` nos textos dos badges
   - Icons com `flex-shrink-0`

5. **Metadata no Rodapé (mt-auto):**
   - Código, Versão, Status, Data agora sempre no final do card
   - `mt-auto` empurra para o bottom
   - Data quebra linha em mobile: `w-full sm:w-auto sm:ml-auto`

**Resultado:** Cards uniformes no grid, títulos visíveis, informações organizadas verticalmente, sem overflow.

**Componentes relacionados:**
- `EticaSection.jsx` — usa DocumentCard em grid 3 colunas
- `ComitesSection.jsx`, `AuditoriasSection.jsx`, `RelatoriosSection.jsx` — mesmo padrão

### 28.3 AuditTrailModal (Polido)

**Arquivo:** `src/pages/management/components/AuditTrailModal.jsx` (280 linhas)

Melhorias:
- Filtros pill por tipo de ação (Todos, Criação, Edição, Aprovação, Arquivamento)
- Filtros pill por período (Todos, 7 dias, 30 dias)
- Badge com contagem de registros no header
- Botão de exportar (placeholder)
- Props `filterAction` e `filterDateRange` passadas ao ChangeLogTimeline

### 28.4 ChangeLogTimeline (Polido)

**Arquivo:** `src/pages/management/components/ChangeLogTimeline.jsx` (373 linhas)

Melhorias:
- Prop `filterAction` com grupos: criacao→[created], edicao→[updated, version_added], aprovacao→[approved, rejected, status_changed], arquivamento→[archived, restored, deleted]
- Prop `filterDateRange` ('all' | '7d' | '30d')
- Exibição de tempo relativo sob timestamps

### 28.5 useComplianceMetrics (Enriquecido)

**Arquivo:** `src/hooks/useComplianceMetrics.js` (227+ linhas)

Métricas Qmentum:
- `qmentumScore` — Score ponderado por QMENTUM_CATEGORIES weights
- `ropAdherence` — Aderência por área ROP (6 áreas)
- `reviewComplianceRate` — Taxa de revisões no prazo (%)
- `approvalCycleTime` — Tempo médio de aprovação (dias)
- `overdueByCategory` — Documentos vencidos por categoria
- `documentCoverage` — Cobertura documental (existentes vs recomendados)

**v3.43.0 — Métricas LGPD adicionadas:**
- Solicitações LGPD pendentes/resolvidas (consulta `lgpd_solicitacoes`)
- Tempo médio de resposta a solicitações
- Mapeamento para ROPs de "Cultura de Segurança" e "Comunicação"

### 28.6 useDocuments (Alertas de Revisão)

**Arquivo:** `src/hooks/useDocuments.js` (135 linhas)

Novas funções:
- `getUpcomingReviews(days)` — Documentos com revisão nos próximos N dias
- `getOverdueDocuments()` — Documentos com revisão vencida
- `getDocumentsByApprovalStatus(status)` — Filtrar por status de aprovação
- `reviewAlerts` — Objeto com arrays `critical`, `warning`, `upcoming`

### 28.7 types/documents.js (Estendido)

**Arquivo:** `src/types/documents.js` (304 linhas)

Adições:
- Status `REVISAO_PENDENTE` com transições válidas
- `APPROVAL_WORKFLOW_TEMPLATE` — Array padrão de aprovadores
- `QMENTUM_CATEGORIES` — 6 áreas com pesos (etica: 1.2, auditorias: 1.5, etc.)
- `COMPLIANCE_FLAGS` enum (REVISION_OVERDUE, APPROVAL_PENDING, MISSING_SIGNATURE, INCOMPLETE_WORKFLOW)
- `createApprovalEntry()` e `getComplianceFlags()` helpers

---

## 29. PLANO DE BANCO DE DADOS - SUPABASE (IMPLEMENTADO ✅)

### 29.1 Decisão Arquitetural

Após pesquisa comparativa (Firebase vs Supabase vs Appwrite vs AWS vs Azure), a decisão é:

**Firebase Auth + Supabase (PostgreSQL + Storage)** — abordagem híbrida

| Aspecto | Firebase | Supabase | Decisão |
|---------|----------|----------|---------|
| Autenticação | Já funcional | Aceita Firebase JWT | **Manter Firebase Auth** |
| Documentos (metadados) | Firestore (NoSQL) | PostgreSQL (relacional) | **Supabase** |
| Storage (arquivos) | Firebase Storage | Supabase Storage | **Supabase** |
| Audit trail | Manual / caro | supa_audit (incluso) | **Supabase** |
| Busca full-text PT-BR | Não suportada | PostgreSQL FTS nativo | **Supabase** |
| RBAC | Security Rules | Row Level Security | **Supabase** |
| Custo (~200 users) | ~$160-380/mês | ~$30-60/mês | **Supabase** |

### 29.2 Schema PostgreSQL (4 tabelas)

```
documentos           → Tabela principal (metadados, FTS, status workflow)
documento_versoes    → Histórico de versões com aprovador
documento_changelog  → Audit trail manual (complementa supa_audit)
documento_aprovacoes → Workflow de aprovação Qmentum
```

### 29.3 Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/config/supabase.js` | **NOVO** — Client Supabase |
| `.env.local` | **NOVO** — Credenciais Supabase |
| `src/services/supabaseDocumentService.js` | **NOVO** — CRUD + FTS + changelog |
| `src/contexts/DocumentsContext.jsx` | Modificar — substituir TODO por Supabase |
| `src/services/uploadService.js` | Modificar — adicionar branch Supabase Storage |
| `src/types/documents.js` | Modificar — USE_MOCK = false |

**Zero alterações em:** hooks, componentes, páginas, sistema de permissões.

### 29.4 Pré-requisitos Manuais

1. Criar conta Supabase em https://supabase.com
2. Criar projeto na região `South America (São Paulo)`
3. Obter credenciais (URL + anon key)
4. Executar SQL do schema no SQL Editor
5. Configurar Firebase Auth como third-party provider
6. Criar bucket `documentos` no Storage

**Plano completo:** `~/.claude/plans/groovy-knitting-noodle.md`

---

## 30. CONFORMIDADE LGPD - GESTÃO DE INCIDENTES (v3.31.0)

### 30.1 Visão Geral

Implementação de conformidade com a LGPD (Lei 13.709/2018) no módulo de Gestão de Incidentes. O sistema coleta dados pessoais sensíveis (nome, email, função, setor, gênero) em formulários de notificação de incidentes e denúncias, exigindo proteção rigorosa.

### 30.2 Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/incidents/NovoIncidentePage.jsx` | userId condicional + checkbox consentimento LGPD + banner DS green |
| `src/pages/incidents/NovaDenunciaPage.jsx` | userId condicional + checkbox consentimento + gênero condicional + banners DS green |
| `src/pages/incidents/MeusRelatosPage.jsx` | Banner informativo sobre relatos anônimos |
| `src/pages/incidents/IncidenteDetalhePage.jsx` | Validação de ownership (só dono acessa detalhes) |
| `src/pages/incidents/DenunciaDetalhePage.jsx` | Validação de ownership (só dono acessa detalhes) |
| `src/contexts/IncidentsContext.jsx` | Ações `ANONYMIZE_INCIDENTE` e `ANONYMIZE_DENUNCIA` no reducer |
| `src/pages/incidents/components/PrivacyPolicyModal.jsx` | **NOVO** - Modal de Política de Privacidade (219 linhas, 11 seções) |
| `src/pages/incidents/components/index.js` | Barrel export incluindo `PrivacyPolicyModal` |
| `src/pages/incidents/QRCodeGeneratorPage.jsx` | Cores uniformizadas para DS green (`#006837`) |

### 30.3 Correções Implementadas

| # | Severidade | Problema | Solução |
|---|-----------|----------|---------|
| P1 | CRITICO | `userId` armazenado em relatos anônimos quebrava anonimato | `userId` condicional: `null` quando `tipoIdentificacao === 'anonimo'` |
| P2 | ALTO | Sem consentimento explícito antes da coleta | Checkbox obrigatório: "Autorizo o tratamento dos meus dados pessoais conforme a LGPD..." |
| P3 | ALTO | Nenhum mecanismo de exclusão de dados | Ações `ANONYMIZE_INCIDENTE`/`ANONYMIZE_DENUNCIA` no reducer |
| P4 | ALTO | Páginas de detalhe sem controle de acesso | Validação de ownership (`userId === user.id`) em IncidenteDetalhePage e DenunciaDetalhePage |
| P5 | MEDIO | Campo gênero armazenado em relatos anônimos | `genero` incluído na lógica de exclusão condicional em NovaDenunciaPage |
| P6 | MEDIO | Sem link para Política de Privacidade | `PrivacyPolicyModal` com 11 seções LGPD completas |
| P7 | MENOR | Sem política de retenção de dados | Documentado na política (5 anos conforme legislação) |

### 30.4 PrivacyPolicyModal

```jsx
import { PrivacyPolicyModal } from './components';

// Uso nos formulários
const [showPrivacy, setShowPrivacy] = useState(false);

<button onClick={() => setShowPrivacy(true)}>Política de Privacidade</button>
<PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
```

**11 seções do modal:**
1. Controlador de Dados (ANEST)
2. Dados Coletados
3. Finalidade do Tratamento
4. Base Legal (Art. 7° e 11° da LGPD)
5. Compartilhamento de Dados
6. Segurança dos Dados
7. Retenção dos Dados (5 anos)
8. Direitos do Titular (Art. 18°)
9. Relatos Anônimos
10. Cookies e Tecnologias
11. Contato - Comitê de Ética

### 30.5 Consentimento Condicional

O checkbox de consentimento aparece apenas quando `tipoIdentificacao !== 'anonimo'` (relatos anônimos não coletam dados pessoais). O envio é bloqueado se o checkbox não estiver marcado.

```jsx
// Exemplo em NovoIncidentePage.jsx
const [consentimento, setConsentimento] = useState(false);

// No submit:
userId: notificante.tipoIdentificacao === 'anonimo' ? null : (user?.id || null),

// Validação:
if (notificante.tipoIdentificacao !== 'anonimo' && !consentimento) {
  // Bloqueia envio
}
```

### 30.6 Uniformidade Visual DS Green

Todas as páginas do módulo de incidentes foram padronizadas com a paleta DS green:

| Elemento | Light | Dark |
|----------|-------|------|
| Banner bg | `#E8F5E9` | `#243530` |
| Banner border | `#C8E6C9` | `#2A3F36` |
| Ícone | `#006837` | `#2ECC71` |
| Título | `#004225` | `white` |
| Texto corpo | `#6B7280` | `#6B8178` |

Páginas atualizadas: `NovoIncidentePage`, `NovaDenunciaPage`, `QRCodeGeneratorPage` (removidas cores purple, blue, orange, yellow/amber).

### 30.7 ProfilePage - Card Agrupado de Ações

Os 3 botões de ação ("Editar Perfil", "Alterar Senha", "Gerenciamento") foram agrupados em um único `Card` com divisores internos e chevron à direita. Cada item permanece individualmente clicável. Botão "Sair" permanece separado abaixo.

```jsx
<Card variant="default" className="mb-4 overflow-hidden">
  <CardContent className="p-0">
    <button>Editar Perfil</button>
    <div className="border-t ..." /> {/* Divisor */}
    <button>Alterar Senha</button>
    {user.isAdmin && <>
      <div className="border-t ..." />
      <button>Gerenciamento</button>
    </>}
  </CardContent>
</Card>
<Button variant="destructive">Sair</Button>
```

**Plano LGPD completo:** `~/.claude/plans/scalable-mixing-moler.md`

---

## 31. MONITORAMENTO DE COMUNICADOS QMENTUM (v3.32.0)

### 31.1 Visao Geral

3 limitacoes corrigidas + painel de monitoramento consolidado no Centro de Gestao:

| Limitacao | Antes | Depois |
|-----------|-------|--------|
| Metricas estimadas | `destinatarios.length * 5` (chute) | `calcularTotalDestinatarios()` com dados reais de `mockUsers` |
| Acoes visuais | Checklist sem persistencia | `acoesCompletadas[]` com tracking individual por user |
| Sem visao consolidada | Admin verificava comunicado a comunicado | Painel com KPIs, conformidade e acoes em 3 tabs |

### 31.2 Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/data/mockComunicados.js` | Import `mockUsers`, helper `calcularTotalDestinatarios()`, campo `acoesCompletadas` nos mocks |
| `src/pages/ComunicadosPage.jsx` | Import `calcularTotalDestinatarios`, metricas reais, funcao `completarAcao()`, Checklist com tracking. Botao "+ Novo" no header (admin only) substituiu FAB |
| `src/pages/management/ManagementLayout.jsx` | Item "Comunicados" com icone `Megaphone` no `NAVIGATION_ITEMS` |
| `src/pages/management/CentroGestaoPage.jsx` | Import + `case 'comunicados'` no `renderContent()` |
| `src/pages/management/comunicados/ComunicadosMonitorTab.jsx` | **NOVO** — Painel completo (3 tabs) |
| `src/pages/management/index.js` | Export `ComunicadosMonitorTab` |

### 31.3 ComunicadosMonitorTab.jsx

**Arquivo:** `src/pages/management/comunicados/ComunicadosMonitorTab.jsx`

**3 Tabs:**

**Tab 1 — Visao Geral:**
- 4 KPI Cards (grid 2x2): Total Publicados (blue), Leitura Obrigatoria (purple), Taxa de Confirmacao (green/amber/red), Prazos Atrasados (red/green)
- DonutChart distribuicao por ROP (usa `ROP_AREAS` com cores)
- Lista de comunicados pendentes (< 100% confirmacao) com Progress bars, ordenados por urgencia

**Tab 2 — Conformidade por Comunicado:**
- Filtros: ROP e Tipo (selects)
- Lista de comunicados com leitura obrigatoria: titulo, badges, Progress bar, porcentagem
- Expandivel: "Quem nao confirmou" com lista nominal (nome + status ativo/inativo)

**Tab 3 — Acoes Requeridas:**
- Lista de comunicados com acoes
- Cada acao mostra Progress bar (completaram/total)
- Expandivel: lista de quem completou cada acao com data

**KPIs calculados:**
```javascript
const publicados = mockComunicados.filter(c => c.status === 'publicado');
const comLeitura = publicados.filter(c => c.leituraObrigatoria);
const totalConfirmacoes = comLeitura.reduce((acc, c) => acc + c.confirmacoes.length, 0);
const totalEsperado = comLeitura.reduce((acc, c) => acc + calcularTotalDestinatarios(c), 0);
const taxaGeral = totalEsperado > 0 ? Math.round((totalConfirmacoes / totalEsperado) * 100) : 0;
const atrasados = comLeitura.filter(c => isPrazoVencido(c)).length;
```

**Componentes DS utilizados:** Card, CardContent, Badge, Progress, DonutChart, Tabs, TabsList, TabsTrigger, TabsContent, cn

**Logica "Quem nao confirmou":**
```javascript
const quemNaoConfirmou = (comunicado) => {
  const destinatarios = comunicado.destinatarios?.length
    ? mockUsers.filter(u => comunicado.destinatarios.includes(u.role))
    : mockUsers;
  const idsConfirmados = new Set(comunicado.confirmacoes.map(c => c.userId));
  return destinatarios.filter(u => !idsConfirmados.has(u.id));
};
```

### 31.4 Tracking de Acoes no ComunicadosPage

**Funcao `completarAcao(comunicadoId, acaoId)`:**
- Toggle: se user ja completou, remove; senao, adiciona
- Registra `{ acaoId, userId, userName, completedAt }`
- Checklist no detalhe: item checked se user atual completou
- Admin ve contagem: "Ler protocolo (3/7)"

### 31.5 Workflow de Aprovacao (ja existente)

Fluxo completo de comunicados:
```
Admin clica "+ Novo" no header (botao compacto h-7, visivel apenas para isAdmin)
  → abrirEdicao() abre modal de criacao
  ├── "Salvar Rascunho" → status: 'rascunho' (so admin ve)
  ├── "Publicar" → status: 'publicado' + aprovadoPor + notificacao
  └── Abre rascunho → Card "Aprovar e Publicar"
       └── aprovarEPublicar() → status: 'publicado' + aprovadoPor
```

- Nao-admins so veem `status === 'publicado'` (filtro na ComunicadosPage)
- Badge "Rascunho" nos cards de rascunho (admin only)
- `aprovadoPor` registra userId, userName, approvedAt

### 31.6 Conformidade Qmentum

| Feature | ROP Mapeado | Evidencia |
|---------|-------------|-----------|
| Destinatarios segmentados | ROP 2 — Comunicacao | Comunicacao direcionada por papel |
| Confirmacao de leitura | ROP 1 — Cultura de Seguranca | Rastreabilidade de disseminacao |
| Categoria ROP | Todos os 6 ROPs | Classificacao por area de pratica |
| Acoes requeridas + tracking | ROP 1 + ROP 3 | Garantia de execucao individual |
| Workflow aprovacao | ROP 1 | Governanca documental |
| Prazo de confirmacao | ROP 2 | Tempestividade |
| Validade/expiracao | ROP 1 + ROP 6 | Controle de vigencia |
| Metricas de conformidade | Todos | Indicadores mensuraveis |

**3 niveis de evidencia para auditoria Qmentum:**
1. **Processo existe** — comunicados segmentados por ROP com workflow de aprovacao
2. **Processo e seguido** — confirmacao de leitura obrigatoria + tracking de acoes + prazos
3. **Resultado e medido** — dashboard com taxa geral, por comunicado, lista nominal de pendentes

### 31.7 Plano Supabase para Comunicados

**4 tabelas:** `comunicados`, `comunicado_confirmacoes`, `comunicado_acoes`, `comunicado_acoes_completadas`

**Views de monitoramento:** `v_comunicado_metricas`, `v_comunicados_kpis`, `v_comunicados_por_rop`, `v_nao_confirmaram`, `v_acoes_progresso`

**Detalhes completos do schema SQL e RLS:** documentado na sessao de planejamento (`~/.claude/plans/nested-munching-tulip.md`)

---

## 32. LACUNAS ESTRUTURAIS — IMPLEMENTAÇÃO COMPLETA

> Sessão inicial: 10/02/2026 | 27 Gaps finais: 21/02/2026 | Status: **100% IMPLEMENTADO ✅**

### 32.1 Incidentes no Supabase (Fase 1)

**Migration:** `supabase/migrations/005_incidents.sql` — executada com sucesso no Supabase de produção.

**Tabela `incidentes`:**
- Campos raiz: `id` (uuid PK), `protocolo` (text UNIQUE auto-gerado), `tracking_code` (text UNIQUE), `status`, `source`, `tipo`, `user_id`, `created_at`, `updated_at`
- JSONB: `notificante`, `incidente_data`, `impacto`, `contexto_anest`, `denuncia_data`, `denunciante`, `admin_data`, `gestao_interna`, `attachments`
- LGPD: `lgpd_consent_at`, `anonymized_at`

**Triggers (3):**
- `tr_incidentes_updated_at` — auto-update `updated_at`
- `tr_incidentes_protocolo` — gera protocolo `INC-YYYYMMDD-XXXX` ou `DEN-YYYYMMDD-XXXX`
- `tr_incidentes_tracking` — gera tracking code `ANEST-YYYY-XXXXXXXX`

**RLS (8 policies):**
- `inc_select_admin` / `inc_select_own` — admin vê tudo, usuário vê seus próprios
- `inc_insert_auth` / `inc_insert_anon` — autenticado qualquer, anon apenas `formulario_publico`/`externo`
- `inc_select_anon_tracking` — anon pode buscar por tracking_code
- `inc_update_admin` / `inc_update_own` — admin atualiza tudo, usuário apenas status `pendente`
- `inc_delete_admin` — apenas admin pode deletar

**RPCs:**
- `rpc_fetch_by_tracking_code(p_tracking_code)` — busca pública por tracking code
- `rpc_anonimizar_incidente(p_id)` — anonimização LGPD

**Service:** `src/services/supabaseIncidentsService.js`
- CRUD completo: `fetchIncidentes`, `fetchDenuncias`, `fetchById`, `fetchByUser`, `fetchByTrackingCode`
- Mutações: `createIncidente`, `createDenuncia`, `updateStatus`, `updateAdminData`, `updateGestaoInterna`, `updateIncidente`
- LGPD: `anonymizeIncidente`
- Real-time: `subscribeToAll`, `unsubscribe`
- Conversão camelCase↔snake_case automática

**Context:** `src/contexts/IncidentsContext.jsx`
- Dual-path mock/Supabase via `USE_MOCK` flag
- useReducer com 8 actions
- Subscription real-time quando `!USE_MOCK`
- `updateGestaoInterna()` faz dispatch local após save no Supabase (v3.42.0), determinando tipo (`UPDATE_INCIDENTE` vs `UPDATE_DENUNCIA`) pelo campo `result.tipo`

**Formulário público:** `public/formulario-incidente.html`
- Integrado com Supabase via anon key (CDN `@supabase/supabase-js`)
- INSERT direto na tabela `incidentes` com `source: 'formulario_publico'`
- Exibe tracking_code retornado após submit

### 32.2 Distribuição de Documentos (Fase 2)

**Componentes novos:**
- `src/components/documents/DistributionPanel.jsx` — painel com status de distribuição (distribuído, visualizado, reconhecido) + métricas + barra de progresso
- `src/components/documents/DistributeModal.jsx` — modal para admin selecionar destinatários por cargo e distribuir documento

**Integração:** `src/pages/DocumentoDetalhePage.jsx`
- 3 tabs: Documento | Distribuição | Audit Trail
- Tabs Distribuição e Audit Trail visíveis apenas para admin
- Auto-registra visualização ao abrir detalhe

### 32.3 Workflow de Aprovação (Fase 3)

**Componente novo:**
- `src/components/documents/ApproverSelect.jsx` — seleção de aprovadores para workflow

**Modificado:** `src/pages/management/documents/ApprovalQueue.jsx`
- Mostra progresso do workflow (barra de progresso + contagem X/Y aprovaram)
- Chips coloridos por aprovador com status (aprovado/rejeitado/pendente)

### 32.4 Notificações In-App (Fase 4)

**Service novo:** `src/services/notificationService.js`
- `notifyDistribution(docTitle, userId)` — documento distribuído
- `notifyApprovalNeeded(docTitle, userId)` — aprovação pendente
- `notifyReviewDue(docTitle, daysLeft)` — revisão próxima
- `notifyStatusChange(protocolo, newStatus)` — status de incidente alterado
- `notifyNewIncident(protocolo)` — novo incidente (admin)
- `notifyApprovalResult(docTitle, approved, comment)` — resultado de aprovação
- Usa callback `notify` (do `MessagesContext.createSystemNotification`)

### 32.5 Audit Trail (Fase 6)

**Componentes novos:**
- `src/components/documents/AuditTrailViewer.jsx` — timeline vertical com filtros por ação e período, paginação 50/página
- `src/pages/management/documents/AuditTrailPage.jsx` — página admin completa

**Rota:** `/gestao/auditoria` em `src/App.jsx`

### 32.6 LGPD no Perfil (Fase 7)

**Modificado:** `src/pages/ProfilePage.jsx`
- Card "Privacidade e Dados (LGPD)" com data de consentimento, exportar dados, solicitar exclusão

**Service novo:** `src/services/lgpdService.js`
- `exportUserData(userId)` — busca todos os dados do usuário (Supabase + Firebase)
- `downloadAsJson(data, filename)` — download como arquivo JSON
- `requestDeletion(userId)` — cria solicitação de exclusão para admin

### 32.7 Resumo do Supabase (Estado Atual)

**Tabelas (9):** `documentos`, `documento_versoes`, `documento_aprovacoes`, `documento_distribuicao`, `documento_changelog`, `user_document_views`, `comunicados_confirmacoes`, `incidentes`, `infra_health_history`

**Views (2):** `v_compliance_dashboard`, `v_distribution_status`

**Funções (11):** `update_updated_at`, `firebase_uid`, `is_admin`, `log_change`, `generate_protocolo`, `generate_tracking_code`, `rpc_fetch_by_tracking_code`, `rpc_anonimizar_incidente` + 3 anteriores

**Conexão:** pooler `aws-0-us-west-2.pooler.supabase.com`, user `postgres.vjzrahruvjffyyqyhjny`

### 32.8 Arquivos Criados/Modificados

| # | Arquivo | Tipo |
|---|---------|------|
| 1 | `supabase/migrations/005_incidents.sql` | NOVO |
| 2 | `src/services/supabaseIncidentsService.js` | NOVO |
| 3 | `src/services/notificationService.js` | NOVO |
| 4 | `src/services/lgpdService.js` | NOVO |
| 5 | `src/components/documents/DistributionPanel.jsx` | NOVO |
| 6 | `src/components/documents/DistributeModal.jsx` | NOVO |
| 7 | `src/components/documents/ApproverSelect.jsx` | NOVO |
| 8 | `src/components/documents/AuditTrailViewer.jsx` | NOVO |
| 9 | `src/pages/management/documents/AuditTrailPage.jsx` | NOVO |
| 10 | `src/contexts/IncidentsContext.jsx` | MODIFICADO |
| 11 | `public/formulario-incidente.html` | MODIFICADO |
| 12 | `src/pages/DocumentoDetalhePage.jsx` | MODIFICADO |
| 13 | `src/pages/management/documents/ApprovalQueue.jsx` | MODIFICADO |
| 14 | `src/pages/ProfilePage.jsx` | MODIFICADO |
| 15 | `src/App.jsx` | MODIFICADO |
| 16 | `src/pages/index.js` | MODIFICADO |

### 32.9 27 Gaps — Conformidade 100% Centro de Gestão (v3.43.0)

> Sessão: 21/02/2026

**Helper de Subscriptions Firestore:**

**Arquivo NOVO:** `src/services/firestoreSubscriptionHelper.js`
- `createFirestoreSubscription(ref, callbacks, options)` — wrapper para `onSnapshot` com:
  - Retry exponencial (1s → 2s → 4s → 8s → max 30s)
  - Detecção de `FirebaseError` e re-subscribe automático
  - Callback `onStatusChange(status)` com valores `'connected'` | `'reconnecting'` | `'error'`
  - Limite configurável de retries
- Reutilizado por `residenciaService.js` e `staffService.js`

**Audit Log de Permissões:**

**Arquivo NOVO:** `src/pages/management/users/AuditLogTab.jsx`
- Tabela de audit trail consultando `permission_audit_log` via `supabaseUsersService.fetchAuditLog()`
- Colunas: data, usuário alvo, ação, alterado por, valores antigo/novo
- Filtros: por usuário, por ação (`role_change`, `permission_update`), por período
- Acessível apenas para admins

**Tabela Supabase:**

**Migration:** `src/sql/infra_health_history.sql` — executada via Supabase Management API

```sql
CREATE TABLE infra_health_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at timestamptz DEFAULT now(),
  firebase_status text,
  supabase_status text,
  supabase_latency_ms int,
  modules_live int,
  modules_total int,
  checked_by text
);
-- RLS: SELECT/INSERT authenticated, DELETE only >90 days
```

**Supabase estado atualizado:** 9 tabelas (+1), 2 views, 11 funções

### 32.10 ErrorBoundary Global (v3.43.0)

**Arquivo:** `src/main.jsx`

Class component `ErrorBoundary` adicionado como wrapper de toda a árvore React para prevenir blank pages em produção:

```
<StrictMode>
  <ErrorBoundary>          ← NOVO
    <ThemeProvider>
      <ToastProvider>
        <UserProvider>
          <AuthGatedProviders>
            <App />
          </AuthGatedProviders>
        </UserProvider>
      </ToastProvider>
    </ThemeProvider>
  </ErrorBoundary>
</StrictMode>
```

- Captura erros via `getDerivedStateFromError` + `componentDidCatch`
- Exibe tela de diagnóstico com erro, stack trace e botão "Recarregar Página"
- Estilo: fundo escuro (#111916), texto verde (#2ECC71), erro em vermelho (#ff6b6b)

**Contexto:** O `AssignStaffModal` era sempre montado (mesmo com `open={false}`) e acessava `staff.hospitais` sem null check enquanto `useStaff` ainda carregava dados do Firestore (`staff === null`). Isso causava `TypeError: Cannot read properties of null (reading 'hospitais')` e blank page.

### 32.11 Resumo de Arquivos (v3.43.0)

| # | Arquivo | Tipo |
|---|---------|------|
| 1 | `src/services/firestoreSubscriptionHelper.js` | NOVO |
| 2 | `src/pages/management/users/AuditLogTab.jsx` | NOVO |
| 3 | `src/sql/infra_health_history.sql` | NOVO |
| 4 | `src/main.jsx` | MODIFICADO (ErrorBoundary) |
| 5 | `src/design-system/components/anest/assign-staff-modal.jsx` | MODIFICADO (null safety) |
| 6 | `src/pages/HomePage.jsx` | MODIFICADO (conditional rendering) |
| 7 | `src/contexts/UsersManagementContext.jsx` | MODIFICADO (UPDATE events, optimistic UI, LGPD subscription) |
| 8 | `src/pages/management/emails/EmailsTab.jsx` | MODIFICADO (connection status) |
| 9 | `src/services/supabaseUsersService.js` | MODIFICADO (changedBy, audit, fetchAuditLog) |
| 10 | `src/pages/management/users/UsersTab.jsx` | MODIFICADO (AuditLogTab) |
| 11 | `src/hooks/useResidencia.js` | MODIFICADO (error handling, reconnection, status) |
| 12 | `src/services/residenciaService.js` | MODIFICADO (createFirestoreSubscription) |
| 13 | `src/hooks/useStaff.js` | MODIFICADO (error handling, reconnection, status) |
| 14 | `src/services/staffService.js` | MODIFICADO (createFirestoreSubscription) |
| 15 | `src/hooks/useInfraStatus.js` | MODIFICADO (saveHealthCheck, cleanup) |
| 16 | `src/pages/management/infra/InfraStatusTab.jsx` | MODIFICADO (role-based visibility) |
| 17 | `src/pages/management/comunicados/ComunicadosMonitorTab.jsx` | MODIFICADO (ROP UI, filtros, compliance) |
| 18 | `src/contexts/ComunicadosContext.jsx` | MODIFICADO (ropRelacionada) |
| 19 | `src/services/supabaseComunicadosService.js` | MODIFICADO (ropRelacionada) |
| 20 | `src/hooks/useComplianceMetrics.js` | MODIFICADO (LGPD metrics) |
| 21 | `src/pages/management/documents/ComplianceDashboard.jsx` | MODIFICADO (LGPD section) |
| 22 | `src/services/lgpdService.js` | MODIFICADO (error handling, validation) |
| 23 | `src/pages/ProfilePage.jsx` | MODIFICADO (LGPD status display) |

---

## COMANDOS RÁPIDOS

```bash
# Iniciar desenvolvimento
npm run dev

# Build produção
npm run build

# Preview build
npm run preview

# Instalar dependência
npm install [package]
```

---

## LOG DE ATUALIZAÇÕES

| Data | Versão | Alterações |
|------|--------|------------|
| 21/02/2026 | 3.43.0 | **27 Gaps Centro de Gestão 100% Conformidade + ErrorBoundary + Fix Blank Page**: 27 gaps em 9 áreas implementados: Emails Sync (UPDATE events, optimistic UI, connection status), Usuários LGPD (changedBy real, audit custom_permissions, AuditLogTab, admin login tracking), Residência Sync (error handling toast, retry backoff, connection status), Funcionários Sync (idem), Infra LGPD (infra_health_history table, retenção 90d, role-based visibility), Comunicados Qmentum (ropRelacionada UI/filtro/compliance), LGPD Qmentum (métricas no hook + seção ComplianceDashboard), LGPD Best Practices (structured errors, input validation, per-source tracking), LGPD Sync (real-time lgpd_solicitacoes, status ProfilePage, probe InfraStatus). **ErrorBoundary** global em main.jsx previne blank pages. **Fix blank page**: `staff?.hospitais` (null safety) + conditional rendering do AssignStaffModal em HomePage. 3 arquivos novos, 20 modificados. Migration `infra_health_history` executada via Supabase Management API. Supabase: 9 tabelas. Build + deploy produção `anest-ap.web.app`. |
| 21/02/2026 | 3.42.0 | **Fix Gestão de Incidentes: Persistência + Dropdown Dinâmico**: Formulário de gestão interna (Painel de Ética) agora carrega dados salvos de `gestaoInterna` ao reabrir (antes inicializava vazio/de `admin`). **IncidenteGestaoPage + DenunciaGestaoPage**: `useState` lê de `incidente.gestaoInterna` (responsável, prioridade, classificação, notas, parecer, recomendações, feedback, RCA, ROPs, ações). Referências de `admin.historicoStatus` → `gestaoInterna.historicoStatus` (com fallback) em `deadlineInfo` e timeline. Dropdown "Responsável pela Análise" usa `incidentResponsibles` do `UsersManagementContext` (via `useUsersManagement()`) com fallback para `MEMBROS_COMITE`. **IncidentsContext.jsx**: `updateGestaoInterna()` agora captura resultado do Supabase e faz `dispatch({ type: result.tipo === 'denuncia' ? 'UPDATE_DENUNCIA' : 'UPDATE_INCIDENTE', payload: result })`, mantendo estado React sincronizado sem reload. 3 arquivos modificados. Build verificado sem erros. Deploy: `anest-ap.web.app`. |
| 18/02/2026 | 3.41.0 | **Reuniões: PDF Viewer + FileUpload Fixes + Participant Notifications**: PDF viewer corrigido em ReuniaoDetalhePage (overlay manual → ViewPdfModal, CORS configurado no Firebase Storage). FileUpload: 4 CSS fixes (`w-full min-w-0`, `flex-1 min-w-0`) para prevenir overflow em modais. Modal.Title: `break-all` para nomes longos com underscores. PDFViewer: prop `showTitle` + removido "Abrir em nova aba". ReunioesPage: `sortByDateTime()` ordena por data+horário (asc/desc). ReuniaoCard: DS tokens (`variant:'default'`, `bg-accent`, `text-primary`). **Notificações de Participantes (NOVO)**: NovaReuniaoModal Step 2 exibe checkbox list de usuários por perfil selecionado (auto-select com preservação de deselections via `useRef`). Submit cria docs em `reuniao_notifications` (Firestore): `convocacao` (imediata) + `lembrete_1d` (1 dia antes) + `lembrete_1h` (1 hora antes) por participante. 3 funções em `reunioesService.js`: `notifyReuniaoParticipantes`, `getUserNotifications`, `markNotificationRead`. Firestore rules: owner-read, admin-create, owner-update (readAt only). Campo `participantesIds[]` salvo na reunião. Review step mostra participantes como pill badges com nota sobre notificações. Funcionalidade opcional (sem perfis = sem notificações). 10 arquivos modificados, 1 collection Firestore nova. Build verificado sem erros. |
| 18/02/2026 | 3.40.0 | **Login Page UX Refresh + Biometric Auth + Keep Me Logged In**: AnimatedBackground fundo clareado (`from-[#006837] to-[#00894B]`), círculos concêntricos e dots mais visíveis (opacidade/border aumentados). LoginPage tipografia aumentada em 1 step (Bem-Vindo, tabs, labels, inputs, botões, biometria, esqueceu senha). Texto alterado "Bem-vindo de volta ao ANEST" → "Bem-Vindo à ANEST". Footer "Suporte • Termos • Privacidade" removido. **Checkbox "Manter conectado"** com `setPersistence()` dinâmico (`browserLocalPersistence` vs `browserSessionPersistence`). **biometricService.js NOVO**: autenticação biométrica completa via WebAuthn/FIDO2 (Face ID + Touch ID + Windows Hello). 6 funções: `isBiometricAvailable`, `hasBiometricRegistered`, `getBiometricEmail`, `registerBiometric`, `authenticateWithBiometric`, `removeBiometric`. Senha cifrada com AES-GCM (PBKDF2 100k iter SHA-256), armazenada em localStorage `anest_biometric`. Config WebAuthn: `authenticatorAttachment: 'platform'`, `userVerification: 'required'`. Fluxo registro: preenche email+senha → "Ativar Face ID / Touch ID" → prompt nativo SO → cifra + salva → login. Fluxo auth: "Entrar com Face ID / Touch ID" → prompt nativo → decifra → `login()`. UI adaptativa: botão só aparece se suportado, texto/ícones (`ScanFace` + `Fingerprint`) mudam conforme estado. **App.jsx**: reset de `currentPage`/`activeNav`/`navigationHistory` para `'home'` quando `!isAuthenticated`, corrige bug de navegação pós-login para "Meu Perfil". Arquivos: `biometricService.js` (NOVO), `animated-background.jsx`, `LoginPage.jsx`, `App.jsx`. Build verificado sem erros. |
| 17/02/2026 | 3.39.0 | **Reuniões DS Color Migration + Modal Fixes**: Migração completa de cores hardcoded para tokens DS em 8 arquivos do módulo Reuniões + Design System. **Modal.Body overflow fix (DS-level)**: `overflow-auto` → `overflow-y-auto overflow-x-hidden` em `modal.jsx`, previne scroll horizontal em todos os modais. **FileUpload DS tokens**: todas as cores hex removidas de `file-upload.jsx`, substituídas por tokens semânticos (`text-primary`, `bg-card`, `border-border`, `focus:ring-ring/30`, etc.). **NovaReuniaoModal reestruturado**: botões movidos para `footer` prop (fora da scroll area), conteúdo em `Modal.Body`, FileUpload de `variant="dropzone"` para `variant="button"` (compacto), preview duplicado removido, todas cores DS. **UploadSubsidioModal + UploadAtaModal**: mesmo padrão `Modal.Body` + `footer`, botões `bg-[#006837]...` → `variant="default"`, zero hex. **4 páginas Reuniões migradas**: ReunioesPage, ReuniaoCard, ReuniaoDetalhePage (+ NovaReuniaoModal) — mapeamento: `text-[#004225] dark:text-[#2ECC71]`→`text-primary`, `bg-white dark:bg-[#1A2420]`→`bg-card`, `border-[#C8E6C9] dark:border-[#2A3F36]`→`border-border`, `hover:bg-[#E8F5E9]`→`hover:bg-secondary`, `focus-visible:ring-[#006837]`→`focus-visible:ring-ring`. Exceções mantidas: TIPO_COLORS (cores semânticas por tipo de reunião). Padrão modal com footer estabelecido para futuros modais. Build verificado sem erros. |
| 16/02/2026 | 3.38.0 | **Correção Ortográfica em Português — Acentuação Completa (5 categorias, 100+ arquivos)**: Correção sistemática de todos os textos em português visíveis ao usuário em toda a aplicação. Implementada em 5 fases paralelas por agentes especializados. **Fase 1 — Services (3 arquivos)**: `authService.js` (10 correções em mensagens de erro: `nao→não`, `ja→já`, `invalido→inválido`, `conexao→conexão`, `faca→faça`, `solicitacao→solicitação`), `pegaPlantaoApi.js` (1 correção), `uploadService.js` (1 correção). **Fase 2 — Data/Config (23 arquivos)**: autoavaliacaoConfig, auditoriasConfig, eticaConfig, planosAcaoConfig, relatoriosConfig, comitesConfig, documentTypes, mockSetores, indicadores-2025 (25 indicadores com títulos corrigidos), auditoriasRelatoriosConfig, mockDocumentos, mockRelatorios, mockAuditoriasRelatorios, mockBiblioteca, mockEtica, mockPlanosAcao, mockAuditorias, mockAuditoriaExecucoes, mockAutoavaliacao, mockComites, rcaConfig, ropCriteriaConfig, auditoriaTemplatesConfig. Padrões: `nao→não`, `relatorio→relatório`, `comite→comitê`, `acoes→ações`, `analise→análise`, `tecnico→técnico`, `periodo→período`, `criterio→critério`, `medicamentos→medicamentos`, `prevencao→prevenção`, `higiene das maos→mãos`. **Fase 3 — Pages (40+ arquivos)**: ProfilePage, IncidenteGestaoPage, DenunciaGestaoPage, ReunioesPage, KpiEventosPage, InboxPage, PoliticaGestaoQualidadePage, PlanoManualPage, PlanoTimesPage, EmergenciaVitimasPage, PlanoAcaoDetalhePage, PlanoAcaoCard, dashboards (DashboardExecutivoPage, QualidadePage), RelatorioIncidentesPage, RelatorioTrimestralPage, RelatorioIndicadoresPage, RelatorioDetalhePage, incidents pages (NovoIncidentePage, NovaDenunciaPage, MeusRelatosPage, IncidenteDetalhePage, DenunciaDetalhePage), CertificadosPage, education pages, faturamento pages. **Fase 4 — Components (20+ arquivos)**: organograma (OrgDetailModal, orgNodeColors), calculator-definitions (extensive fixes em 25+ calculadoras médicas), showcase components (PlantoesShowcase, DataDisplayShowcase, EducacaoContinuadaShowcase, GestaoDocumentalShowcase), PlanoAcaoDetalhePage, PlanoAcaoCard, PdcaStepper. **Fase 5 — Contexts/Hooks (4 arquivos)**: ResidenciaChatContext (60+ correções em mensagens de chat), useDashboardExecutivo (18 protocolos + alertas), useEducacao (mensagens de erro), usePegaPlantao (dados mock). **Fase 6 — PDF Templates**: certificadoProfissionalTemplate, relatorioCompletoTemplate, qualidadeReportTemplate. **Escopo geral**: apenas strings visíveis ao usuário foram modificadas. Variáveis, chaves de objetos, nomes de funções e valores de enum em comparações de código (ex.: `'concluido'` em `status === 'concluido'`) foram preservados. Total de arquivos corrigidos: 100+. Padrões comuns: `á/ã/â/é/ê/í/ó/õ/ô/ú/ç` adicionados onde faltavam em títulos, labels, placeholders, descriptions, toast messages, error messages, e todos os textos de UI. |
| 15/02/2026 | 3.37.0 | **Fix Dashboard Executivo — PDF Export, Funcionalidades Ausentes e Bugs (8 correções)**: Auditoria profunda do DashboardExecutivoPage identificou 8 problemas após unificação dos dashboards Qmentum. **(P1-CRÍTICO) Template PDF `qualidadeReport` criado**: `qualidadeReportTemplate.js` NOVO (11 seções: score geral, narrativa, pilares 2x2, alertas, ROPs por área via drawTable, auditorias, planos PDCA com drawProgressBar, KPIs, próximos passos, conquistas, progresso do ciclo). Registrado em `pdfService.js` TEMPLATES como lazy import. Reutiliza utilities de `pdfBranding.js` (ANEST_COLORS, PAGE, addSectionTitle, drawStatBox, drawProgressBar, drawTable, checkPageBreak, getStatusColor). **(P2-CRÍTICO) AdminOnly no botão PDF**: ExportButton + botão Calendar envolvidos em `<AdminOnly user={user}>` com `useUser()`. **(P3-ALTO) Modal Gerenciar Ciclo**: Modal com card visual do ciclo atual (datas, progress bar, score/nível/pendências), Select para trocar ciclo via `useAutoavaliacao().setCiclo()`, helper `getCycleInfo()`. **(P4-ALTO) BottomNav no DashboardExecutivoPage**: Adicionado BottomNav com 4 itens (Home/Shield ativo/Education GraduationCap/Menu), onItemClick navega para home/gestao/educacao/menuPage. **(P5-ALTO) QualidadePage BottomNav fix**: `console.log('Educacao')`→`onNavigate('educacao')`, `console.log('Menu')`→`onNavigate('menuPage')`. **(P6-ALTO) Null guards em useDashboardExecutivo.js**: 6 guards adicionados — `(incidents.incidentes \|\| [])` em 3 forEach/filter, `(incidents.denuncias \|\| []).length`, `Object.entries(compliance.documentCoverage \|\| {})`. **(P7-MÉDIO) Tendência KPI de dados reais**: Substituída lógica status-derived (`success→down`, `destructive→up`) por comparação dos últimos 2 valores não-null de `ind.meses` em KpiRankingSection e KpiFullList. **(P8-MÉDIO) CoberturaSection null guard**: `coverageChartData.map()`→`(coverageChartData \|\| []).map()` no useMemo do DonutChart de cobertura documental. Arquivos: `qualidadeReportTemplate.js` (NOVO), `pdfService.js`, `DashboardExecutivoPage.jsx`, `QualidadePage.jsx`, `useDashboardExecutivo.js`. Hook `useDashboardExecutivo` adicionado à Seção 6.1. `DashboardExecutivoPage` adicionada à Seção 13.1. Build verificado sem erros. |
| 13/02/2026 | 3.36.0 | **Fix Botões Admin Painel Qmentum (QualidadeDashboardCard)**: 3 botões admin no rodapé do QualidadeDashboardCard corrigidos e aprimorados. **1) Gerenciar Ciclo → Modal inline**: Antes navegava para CentroGestao aba "indicadores" (inexistente). Agora abre `<Modal size="sm">` com: card visual do ciclo atual (gradiente `from-primary/5 to-success/5`, ícone Calendar em badge, Badge dinâmico de dias restantes com cor por urgência — verde >30d, amarelo 15-30d, vermelho <15d), timeline visual de datas (dots + linha), `<Progress>` colorida por urgência, resumo 3 métricas (Score Geral / Nível / Pendências) separados por dividers, `<Select>` com `CYCLE_OPTIONS` para trocar ciclo via `useAutoavaliacao().setCiclo()`, texto explicativo, toast de sucesso. Helper `getCycleInfo()` computa datas/elapsed/remaining/progress. **2) Exportar Relatório → PDF completo com jsPDF**: Antes navegava para RelatoriosPage (listagem de documentos). Agora gera PDF A4 inline com `generateQualidadeReport()` (~350 linhas): header verde com titulo/subtitulo/ciclo/data, score geral card (36pt + nível + dias restantes), narrative completa (headline + subitems), 4 pillar cards em grid 2x2 (mini progress bars + detail text), alertas com badges de severidade (URGENTE/ATENCAO), tabela ROPs por área (6 áreas com conformes/parciais/NC + evidências), auditorias (4 stat cards + score médio + últimas concluídas), planos PDCA (taxas conclusão/eficácia com barras + breakdown status/origem), KPIs (5 stat cards + indicadores abaixo da meta), próximos passos numerados com círculos de prioridade, conquistas desbloqueadas (com descrição) + em progresso (com barras), progresso do ciclo card, paginação em todas as páginas, auto page-break. `jspdf` v4.0.0 já instalada. Toast de sucesso/erro. **3) Config → CentroGestao (seção padrão)**: Antes navegava para aba "estatisticas" (stats de usuários, não qualidade). Agora navega para `onNavigate('centroGestao')` sem `initialSection`, abrindo na seção padrão "usuarios". **Novos imports em QualidadeDashboardCard**: `Modal`, `Select` de `@/design-system`, `useAutoavaliacao` de `@/contexts/AutoavaliacaoContext`, `useToast` de `@/design-system/components/ui/toast`, `CYCLE_OPTIONS` de `@/data/autoavaliacaoConfig`, `jsPDF` de `jspdf`. **Hooks adicionados ao Seção 6.1**: `useQualidadeDashboard`, `useAutoavaliacao`. Arquivo: `src/pages/qualidade/QualidadeDashboardCard.jsx`. Build verificado sem erros. |
| 12/02/2026 | 3.35.0 | **Correção Definitiva de Cores — Alinhamento com DS (border-border-strong)**: Migração sistemática de cores hardcoded para tokens semânticos do Design System em 13 arquivos (11 páginas + 2 infraestrutura). **Fase 1 — Infraestrutura**: `anest-theme.css` corrigido `--border-strong` dark mode de `154 17% 27%` (#344840) para `154 20% 21%` (#2A3F36, padrão DS card border). `tailwind.config.js` adicionado mapeamento `"border-strong": "hsl(var(--border-strong))"` — classe `border-border-strong` agora disponível. **Fase 2 — Migração de bordas (11 arquivos, ~28 substituições)**: `border-[#A5D6A7] dark:border-[#2A3F36]` → `border-border-strong` em todos os cards de listagem. `hover:border-[#A5D6A7]` → `hover:border-border-strong`. `hover:border-[#C8E6C9]` → `hover:border-border`. Arquivos: AuditoriasInterativasPage, AuditCard, AuditChecklistItem, AuditScoreCard, NovaAuditoriaPage, ExecucaoAuditoriaPage, AuditoriaResultadoPage, AutoavaliacaoPage, AutoavaliacaoAreaPage, AutoavaliacaoRopPage, AutoavaliacaoRelatorioPage. **Fase 3 — Overrides dark redundantes removidos**: `bg-muted dark:bg-[#243530]` → `bg-muted` (token já resolve para #243530 no dark). `bg-[#E8F5E9] dark:bg-[#243530]` → `bg-muted`. 4 arquivos afetados. **Fase 4 — Cores de status com tokens**: `text-[#DC2626]` → `text-destructive` (6 ocorrências, match exato). `text-[#6B7280]` → `text-muted-foreground` (2 ocorrências). Mantidos hardcoded: `text-[#10B981]` (≠ token success), `text-[#F59E0B]` (dark mode difere), cores inline de config/gráficos. **Scan de cores não-DS**: nenhuma cor laranja/roxa/azul decorativa encontrada nos 11 arquivos. Seção 9.2 atualizada com `border-border-strong`, tabela de tokens de borda, e exceções expandidas. Padrão de header atualizado para tokens semânticos. Build verificado sem erros. |
| 11/02/2026 | 3.34.2 | **DonutChart — Reescrito com Recharts + Fix Legend Navigation**: DonutChart reescrito de implementação SVG pura para **recharts** (`PieChart`, `Pie`, `Cell`, `Sector`, `ResponsiveContainer`). recharts v2.15.4 já instalado no projeto, battle-tested, compatível com React 19. Segmento ativo expande via `activeShape` (Sector com `outerRadius + 4`). Tamanhos via `ResponsiveContainer` + `innerRadius="62%"` / `outerRadius="88%"`. `paddingAngle={2}` para gap entre segmentos (0 se item único). `stroke="none"` remove borda branca padrão. **Fix de navegação na legenda**: clique nos itens da legenda (lista abaixo do donut) agora apenas faz highlight visual do segmento correspondente (toggle `selectedIndex`), **sem** disparar `onItemClick`. Somente clique nos segmentos do gráfico (arcos do pie chart) dispara `onItemClick`, que no PlanoAcaoDashboard filtra por status e muda para a tab "lista". Funções separadas: `handleLegendClick` (visual only) vs `onPieClick` (visual + callback). API pública inalterada: `data`, `labelKey`, `valueKey`, `title`, `totalLabel`, `size`, `showLegend`, `showTotal`, `maxCategories`, `othersLabel`, `formatValue`, `onItemClick`, `className`. 3 consumidores compatíveis sem alterações: PlanoAcaoDashboard, KpiDashboardOverview, ComunicadosMonitorTab. Arquivo: `src/design-system/components/ui/donut-chart.jsx`. Build verificado sem erros. |
| 11/02/2026 | 3.34.1 | **ComunicadosPage — Botão "+ Novo" no Header**: Botão de criar comunicado movido de FAB (Floating Action Button circular fixo no canto inferior direito) para o header, seguindo padrão do PlanosAcaoPage. Botão `Button size="sm"` com override `h-7 min-h-0 px-2.5 text-xs` e ícone `Plus w-3.5 h-3.5` para caber na altura padrão do header (`py-3`, spacer `h-14` = 56px) sem expandir. Visível apenas para admin (`isAdmin`). FAB removido completamente (bloco `motion.button` com animação spring). Arquivo: `src/pages/ComunicadosPage.jsx`. |
| 11/02/2026 | 3.34.0 | **Trocas Plantão Role-Based + DonutChart Pure SVG + TradeRequestForm DS**: **1) Trocas de Plantão — Controle por Role (`medico-residente`)**: Regra "todos veem, só residente cria". **useTrocaPlantao.js**: helpers `isResidente(user)` e `canManageTrades(user)` (residente OU admin), guard em `createTrade` retornando erro se não autorizado, campos `solicitanteRole`/`solicitanteAno` incluídos na criação. **trocaPlantaoService.js**: aceita e persiste `solicitanteRole`/`solicitanteAno`. **TrocasPlantaoPage.jsx**: FAB condicionado a `canManageTrades`, `onAccept`/`onReject`/`onCreateNew` passados como `undefined` para não-residentes, banner informativo para não-residentes. **TradeCard.jsx**: botões aceitar/rejeitar condicionados a existência dos handlers (`onAccept || onReject`). **2) DonutChart — Reescrito para Pure SVG (zero deps)**: Removida dependência de recharts. Técnica `stroke-dasharray` + `rotate()` com `r=15.9155` (circunferência ≈ 100 para math fácil de percentagem). Guardas defensivos: `Array.isArray(data)` contra null, `Number.isFinite()` para valores, `Number()` coercion em toda pipeline, `fill="none"` (SVG padrão). Interatividade: hover/click nos segmentos e legenda, centro mostra valor do item ativo ou total, empty state com ícone SVG. 10 cores ANEST palette. Props: `data`, `labelKey`, `valueKey`, `title`, `totalLabel`, `size` (sm/md/lg → 160/200/240px), `showLegend`, `showTotal`, `maxCategories`, `othersLabel`, `formatValue`, `onItemClick`, `className`. Consumidores: PlanoAcaoDashboard, KpiDashboardOverview, ComunicadosMonitorTab, DataDisplayShowcase — todos compatíveis sem alterações. **3) TradeRequestForm — DS Textarea**: `<textarea>` raw substituído por `Textarea` do DS com `maxLength={200}`, `showCount`, `resize="none"`. Spacing melhorado (`space-y-4`), botões com `gap-3`. Build verificado sem erros. |
| 11/02/2026 | 3.33.1 | **ResidenciaHubPage — Card Trocas de Plantão Full-Width**: Card "Assistente IA" comentado (em standby, Edge Function deploy pendente). Grid alterado de `grid-cols-2` para `grid-cols-1`, fazendo o card "Trocas de Plantão" ocupar 100% da largura. Arquivo: `src/pages/ResidenciaHubPage.jsx` (linhas 46-72). Build verificado sem erros. |
| 10/02/2026 | 3.33.0 | **Lacunas Estruturais — Implementação Completa (7 Fases)**: **Fase 1 — Incidentes Supabase**: Migration `005_incidents.sql` executada em produção. Tabela `incidentes` com 15+ campos + JSONB aninhados, 3 triggers (auto-protocolo `INC/DEN-YYYYMMDD-XXXX`, tracking code `ANEST-YYYY-XXXXXXXX`, updated_at), 8 RLS policies (admin/auth/anon), 2 RPCs (fetch by tracking, anonimizar LGPD). **supabaseIncidentsService.js** NOVO (CRUD + real-time + camelCase↔snake_case). **IncidentsContext.jsx** refatorado para dual-path mock/Supabase via `USE_MOCK`. **formulario-incidente.html** migrado de Firebase para Supabase anon key. **Fase 2 — Distribuição**: **DistributionPanel.jsx** + **DistributeModal.jsx** NOVOS. **DocumentoDetalhePage.jsx** modificado com 3 tabs (Documento/Distribuição/Audit Trail), tabs admin-only. **Fase 3 — Aprovação**: **ApproverSelect.jsx** NOVO. **ApprovalQueue.jsx** modificado com barra de progresso + chips de status por aprovador. **Fase 4 — Notificações**: **notificationService.js** NOVO com 6 funções de trigger usando callback `notify` do MessagesContext. **Fase 5 — Dashboard**: verificado ComplianceDashboard existente. **Fase 6 — Audit Trail**: **AuditTrailViewer.jsx** + **AuditTrailPage.jsx** NOVOS, rota `/gestao/auditoria` em App.jsx. **Fase 7 — LGPD Perfil**: **lgpdService.js** NOVO (exportUserData, downloadAsJson, requestDeletion). **ProfilePage.jsx** modificado com card LGPD (consentimento, export, exclusão). Total: 9 arquivos novos, 7 modificados. Build verificado sem erros. Supabase agora com 8 tabelas, 2 views, 11 funções. Nova Seção 32. |
| 10/02/2026 | 3.32.0 | **Monitoramento de Comunicados Qmentum**: 3 limitações corrigidas + painel de monitoramento consolidado. **Correção 1 — Métricas reais**: `calcularTotalDestinatarios()` substituiu estimativa `cargos × 5`, usa `mockUsers` ativos filtrados por role. **Correção 2 — Tracking de ações**: campo `acoesCompletadas[]` com `{acaoId, userId, userName, completedAt}` adicionado aos mocks; função `completarAcao()` no ComunicadosPage com toggle individual; Checklist mostra estado real por user, admin vê contagem "X/Y". **Correção 3 — Painel consolidado**: **ComunicadosMonitorTab.jsx** NOVO em `management/comunicados/` com 3 tabs: (Tab 1) Visão Geral com 4 KPI cards (Total Publicados, Leitura Obrigatória, Taxa Confirmação, Atrasados) + DonutChart por ROP + lista de pendentes com Progress; (Tab 2) Conformidade com filtros ROP/Tipo, progress por comunicado, "Quem não confirmou" expandível com lista nominal; (Tab 3) Ações Requeridas com progress por ação e detalhes de quem completou. **ManagementLayout.jsx**: item "Comunicados" (Megaphone) adicionado ao `NAVIGATION_ITEMS`. **CentroGestaoPage.jsx**: `case 'comunicados'` + import. **index.js**: export. **mockComunicados.js**: import `mockUsers`, helper exportado, `acoesCompletadas` em 3 comunicados com dados mock. Conformidade Qmentum: 8 features mapeadas para ROPs 1-6, 3 níveis de evidência para auditoria (processo existe, é seguido, resultado medido). Plano Supabase documentado (4 tabelas + 5 views SQL). Nova Seção 31 + Seção 17.7. |
| 09/02/2026 | 3.31.0 | **Conformidade LGPD + ProfilePage Card Agrupado**: **7 correções LGPD** implementadas no módulo de Gestão de Incidentes. (P1-CRÍTICO) `userId` condicional: `null` em relatos anônimos para garantir anonimato real. (P2-ALTO) Checkbox de consentimento obrigatório em `NovoIncidentePage` e `NovaDenunciaPage` (apenas para identificado/confidencial). (P3-ALTO) Ações `ANONYMIZE_INCIDENTE`/`ANONYMIZE_DENUNCIA` adicionadas ao reducer em `IncidentsContext.jsx`. (P4-ALTO) Validação de ownership em `IncidenteDetalhePage` e `DenunciaDetalhePage`. (P5-MÉDIO) Campo `genero` excluído em relatos anônimos de denúncia. (P6-MÉDIO) **PrivacyPolicyModal.jsx** NOVO (219 linhas): modal com 11 seções LGPD completas, controlador ANEST, base legal, direitos do titular, retenção 5 anos. Exportado via `components/index.js`. (P7-MENOR) Política de retenção documentada. **Uniformidade DS Green**: banners LGPD em NovoIncidentePage (purple→green), NovaDenunciaPage (purple+blue→green), QRCodeGeneratorPage (orange/purple ícones→`#006837`, yellow "Dicas de Uso"→green, emerald info banner→DS green). **ProfilePage**: 3 botões (Editar Perfil, Alterar Senha, Gerenciamento) agrupados em Card único com divisores e ChevronRight, cada um individualmente clicável. Botão "Sair" permanece separado. **MeusRelatosPage**: banner informativo sobre relatos anônimos rastreáveis por código. Arquivos: `NovoIncidentePage.jsx`, `NovaDenunciaPage.jsx`, `MeusRelatosPage.jsx`, `IncidenteDetalhePage.jsx`, `DenunciaDetalhePage.jsx`, `IncidentsContext.jsx`, `PrivacyPolicyModal.jsx`, `components/index.js`, `QRCodeGeneratorPage.jsx`, `ProfilePage.jsx`. Nova Seção 30. |
| 09/02/2026 | 3.30.0 | **Busca Inline com Dropdown na HomePage**: SearchBar da HomePage agora exibe resultados em dropdown live diretamente abaixo do campo de busca, sem navegar para SearchResultsPage. Usa `searchAll()` de `searchUtils.js` via `useMemo` para busca reativa. Dropdown com 2 seções: "Seções" (max 5, com ícone Lucide via `iconMap` de 30+ ícones) e "Documentos" (max 4, ícone FileSearch). Cada item mostra label/título + descrição + ChevronRight. Estado vazio "Nenhum resultado encontrado". Comportamento: aparece ao digitar, fecha ao blur (200ms delay), fecha ao selecionar resultado (`setSearch('')`), Enter faz blur. `onSubmit` do SearchBar agora faz `document.activeElement?.blur()` em vez de navegar. `onFocus`/`onBlur` passados via `...props` ao input do SearchBar. Dropdown posicionado `absolute z-50 mt-1` com `max-h-[60vh] overflow-y-auto`, estilo consistente com DS (rounded-2xl, border verde, dark mode). SearchResultsPage mantida intacta. Novos imports: `useMemo`, `searchAll`, `ChevronRight`, 30+ ícones Lucide. Arquivo: `HomePage.jsx`. Seção 17.6 documenta searchUtils. |
| 09/02/2026 | 3.29.0 | **Atalhos Rápidos Expandidos (25→33 opções)**: Adicionados 8 novos atalhos ao sistema de personalização da HomePage. **Novos atalhos**: `faturamento` (Receipt, gestão), `incidentes` (AlertOctagon, qualidade), `relatorios` (FileBarChart, qualidade), `gestao-documental` (FolderOpen, documentos), `ranking-rops` (Trophy, educação), `mensagens` (Mail, comunicação), `meus-relatos` (FileSearch, comunicação). **Categorias atualizadas**: Gestão 3→4, Qualidade 6→8, Documentos 3→4, Educação 4→5, Comunicação 2→4. **Bugs corrigidos**: atalho `rops` navegava para página inexistente `'rops'` → corrigido para `'ropsDesafio'`; atalho `podcasts` navegava para `'podcasts'` (inexistente) → corrigido para `'ropsPodcasts'`; atalho `educacao-continuada` navegava para `'educacao'` → corrigido para `'educacaoContinuada'`. **7 novos ícones no iconMap** do `quick-links-grid.jsx`: Receipt, AlertOctagon, FileBarChart, FolderOpen, Trophy, Mail, FileSearch. Arquivos: `mockAtalhos.js`, `quick-links-grid.jsx`, `HomePage.jsx`. |
| 08/02/2026 | 3.28.0 | **Plantões FDS 48h (P1-P11)**: Plantonistas de sábado agora ficam expostos por 48 horas contínuas (sáb 7h → seg 7h). Nova função `isWeekendMode()` detecta modo FDS (sáb 7h+, dom todo, seg madrugada). Nova função `getSabadoDoFDS()` sempre retorna data de sábado durante FDS. `getPlantoesHojePorSetor()` busca SEMPRE dados de sábado no modo FDS, sem filtro `plantaoEmAndamento`. `SETORES_CONFIG.sabadoTarde` e `domingo` atualizados para todos os 11 setores (P1-P11). Hook `useEscalaDia()` exporta `plantoesFDS` (deduplicado por setor). PlantaoCard: botão expandir mostra texto "Ver todos"/"Recolher" (não mais ícone). HomePage: FDS usa `plantoesFDS` com card expandable in-place (4 iniciais → 11 ao expandir). EscalasPage: usa `plantoesCombinados` sempre. Arquivos: `pegaPlantaoApi.js`, `usePegaPlantao.js`, `HomePage.jsx`, `EscalasPage.jsx`, `plantao-card.jsx`. Nova subseção 22.12. |
| 08/02/2026 | 3.26.0 | **Centro de Gestão Qmentum Completo + Plano Supabase**: **FinanceiroSection.jsx** reescrito de placeholder "Em breve" para seção completa (516 linhas) com 6 tipos de documentos financeiros, 6 categorias, 4 sub-tabs (documentos, categorias, arquivados, stats), reutilizando FilterBar/DocumentCard/StatsCard. **AuditTrailModal.jsx** polido (280 linhas): filtros pill por tipo de ação (5) e período (3), badge de contagem, botão exportar. **ChangeLogTimeline.jsx** polido (373 linhas): props filterAction com grupos de ações mapeados, filterDateRange ('all'/'7d'/'30d'), tempo relativo. **useComplianceMetrics.js** enriquecido (227 linhas): qmentumScore ponderado, ropAdherence por área, reviewComplianceRate, approvalCycleTime, overdueByCategory, documentCoverage. **useDocuments.js** expandido (135 linhas): getUpcomingReviews(days), getOverdueDocuments(), getDocumentsByApprovalStatus(status), reviewAlerts com critical/warning/upcoming. **documents.js** estendido (304 linhas): status REVISAO_PENDENTE, APPROVAL_WORKFLOW_TEMPLATE, QMENTUM_CATEGORIES (6 áreas com weights), COMPLIANCE_FLAGS enum, createApprovalEntry(), getComplianceFlags(). **CentroGestaoShowcase.jsx** NOVO (945 linhas): 10 seções interativas documentando todos componentes do Centro de Gestão, registrado em ShowcaseIndex com ícone Settings. **Pesquisa de banco de dados**: análise comparativa Firebase vs Supabase vs Appwrite vs AWS vs Azure. Decisão: abordagem híbrida Firebase Auth + Supabase (PostgreSQL) para gestão documental. Plano completo com schema SQL (4 tabelas), RLS, FTS em português, supa_audit. Seções 28-29 documentam as alterações e o plano Supabase. |
| 07/02/2026 | 3.25.1 | **Melhorias no Sistema de Mensagens (3 fixes)**: **MessagesContext.jsx**: Nova função `markAsUnread(messageId)` que seta `readAt: null`, exportada no Provider value. **MessageDetailPage.jsx**: Importado `markAsUnread` do context, corrigido `handleMarkUnread` (era stub que só fazia `goBack()`), novo botão "Nao lida" com ícone `Mail` entre Arquivar e Excluir (apenas para mensagens, não notificações). **InboxPage.jsx**: (1) Seção colapsável "Arquivadas (N)" na tab Mensagens com ícone `Archive`, state `showArchived`, lista com `opacity-70` — mostra mensagens arquivadas via `getArchivedMessages()`. (2) Fix truncamento tab "Notificacoes": `data-[state=active]:flex-[2.5]` → `data-[state=active]:flex-[3]` nos 4 TabsTriggers. (3) Removido ícone `CheckCheck` do header, mantido apenas `ListFilter` para filtro de não lidas. |
| 07/02/2026 | 3.25.0 | **Comunicação DS Tokens - Cores Padronizadas**: Migradas todas as cores hardcoded (hex com `dark:` prefix) para tokens semânticos do Design System nos componentes de comunicação. **notification-card.jsx** (8 substituições): `bg-white dark:bg-[#1A2420]` → `bg-card`, `text-black dark:text-white` → `text-foreground`, `text-[#6B7280] dark:text-[#A3B8B0]` → `text-muted-foreground`, `border-[#C8E6C9] dark:border-[#2A3F36]` → `border-border`, `border-[#F59E0B]/30` → `border-warning/30`, `border-[#DC2626]/30` → `border-destructive/30`, `hover:bg-[#F3F4F6] dark:hover:bg-[#243530]` → `hover:bg-muted`. **message-card.jsx** (14 substituições): mesmas migrações + `ring-[#006837] dark:ring-[#2ECC71]` → `ring-primary`, `border-l-[#006837]` → `border-l-primary`, `bg-[#006837] dark:bg-[#2ECC71]` → `bg-primary`, `ring-white dark:ring-[#1A2420]` → `ring-card`. **message-list.jsx** (2 substituições): badge não lidas → `bg-primary text-primary-foreground`, ícone busca → `text-muted-foreground`. **InboxPage.jsx** (1 substituição): `bg-[#F59E0B]` → `bg-warning`. **MessageDetailPage.jsx** (1 substituição): botão de ação de notificação removido `style={{ backgroundColor: catColor }}` → usa `bg-primary` padrão do Button DS. Cores dinâmicas de categoria (`--notif-color`) preservadas intencionalmente em notification-card. Seção 9.2 atualizada com regras de tokens. Nova Seção 27 documenta o sistema completo de comunicação. |
| 06/02/2026 | 3.24.0 | **Visual Overhaul: Navigator Card + EducacaoContinuadaPage**: TreeNavigator rows restylados de "card individual" (border, bg-card, shadow) para padrão flat NavLink/SidebarItem (sem border, hover:bg-muted/60, selected:bg-[#D4EDDA]). Connector lines 2px→1px com 40% opacity. Container spacing reduzido. AdminConteudoPage toolbar: search full-width, 4 botões em grid simétrico (grid-cols-4, todos ghost/text-xs/w-full). StepTrilha checkbox grid: auto-rows-[1fr] para alturas uniformes, items-center, text-xs mobile, grid-cols-2 sm:grid-cols-4. CascadeCreator stepper: connectors largura fixa (w-10 sm:w-14), icons centralizados (justify-center), shrink-0. **EducacaoContinuadaPage**: Search bar migrada de Card>Input para `SearchBar` do DS (idêntico à HomePage, com ícone verde e borda temática). Botões "FILTRAR CURSOS/TRILHAS" (filled, uppercase) → `size="sm" variant="outline"` sentence case. Wrapper div desnecessário removido. Arquivos: TreeNavigator.jsx, AdminConteudoPage.jsx, StepTrilha.jsx, CascadeCreator.jsx, EducacaoContinuadaPage.jsx. Seções 26.23–26.24 documentam todas as alterações. |
| 05/02/2026 | 3.23.1 | **Fix Timezone + Lógica 24h de Exposição (Plantões)**: Corrigido bug de timezone onde `toISOString()` convertia para UTC causando datas erradas após 21h em Brasília (UTC-3). Nova função `formatarDataLocal()` formata datas usando horário local. Nova função `getDataEfetiva()` implementa regra de 24h de exposição: plantonistas noturnos (19:00-07:00) ficam visíveis de 07:00 do dia do plantão até 07:00 do dia seguinte. Exemplo: plantão quinta 19:00-sexta 07:00 aparece de quinta 07:00 até sexta 07:00. `getPlantoesHojePorSetor()` simplificada usando as novas funções. Arquivo: `src/services/pegaPlantaoApi.js`. Subseção 22.11 atualizada com nova documentação. |
| 05/02/2026 | 3.23.0 | **Lógica de Madrugada para Plantões + Ajustes UI**: Card "Plantões" agora mantém plantonistas visíveis até 7h (hora real de troca). Novas funções em `pegaPlantaoApi.js`: `HORA_CORTE_PLANTAO`, `estaNaMadrugada()`, `plantaoEmAndamento()`. Lógica diferenciada: madrugada (00-07h) mostra plantão do dia anterior em andamento, dia (07-19h) mostra plantão noturno que começará às 19h, noite (19-24h) mostra plantão em andamento. Card nunca fica vazio em dias úteis. **Card Férias**: Título alterado de "Férias Programadas" para "Férias". Período não repete data quando início=fim (ex: "05/02" em vez de "05/02 - 05/02"). **Residentes**: Nomes atualizados - R1 (em branco, João, Roosewelt), R2 (Daniel, Jacinta, Rodrigo), R3 (Raffaela, Wagner). Arquivos: `pegaPlantaoApi.js`, `usePegaPlantao.js`, `HomePage.jsx`, `mockResidencia.js`. Nova subseção 22.11 documenta a lógica completa. |
| 03/02/2026 | 3.22.1 | **ComunicadosPage - Tokens DS nos Cards + Fix Modal**: Cards da lista de comunicados migrados de cores hardcoded (hex) para tokens semânticos do Design System. **Cards**: `bg-white dark:bg-[#1A2420]` → `bg-card`, `border-[#C8E6C9] dark:border-[#2A3F36]` → `border-[hsl(var(--border-strong))]`, título → `text-card-foreground`, subtextos → `text-muted-foreground`, data/meta → `text-muted-foreground/60`, divider admin → `border-[hsl(var(--card-elevated))]`. Estado não lido: gradiente substituído por cor sólida `bg-[hsl(var(--card-highlight))]` com condicional exclusivo (`!lido ? highlight : card`). Faixa lateral colorida por tipo e sombras mantidas. **Modal Ver Comunicado**: Layout reestruturado com `flex flex-col`. Overlay com `pt-16 pb-20` para não ser ocultado pelo header da página (64px top) nem pelo bottom nav (80px bottom). Modal usa `max-h-full` (constrained pelo padding do overlay). Header e footer com `shrink-0`, conteúdo com `flex-1 min-h-0 overflow-y-auto`. Botões "Marcar não lido" e "Arquivar" sempre visíveis como footer fixo do modal. Arquivo: `src/pages/ComunicadosPage.jsx`. |
| 08/02/2026 | 3.22.1 | **Fix Bottom Sheet Settings em Fullscreen (VideoPlayer)**: Corrigido bug onde o bottom sheet de configurações (velocidade de reprodução) não aparecia em fullscreen no mobile. **Causa raiz**: `createPortal` renderizava no `document.body`, que fica fora do contexto fullscreen do navegador (fullscreen só exibe o elemento fullscreen e seus filhos). Além disso, um `useEffect` fechava o settings ao mudar fullscreen. **Solução**: (1) Portal target dinâmico — em fullscreen usa `containerRef.current` (o elemento fullscreen), fora usa `document.body`; (2) Removido `useEffect(() => { setShowSettings(false) }, [isFullscreen])` que fechava o bottom sheet desnecessariamente. Arquivo: `src/design-system/components/ui/video-player.jsx`. **Padrão**: quando usar `createPortal` em componentes que podem estar em fullscreen, o target deve ser dinâmico (`isFullscreen ? containerRef.current : document.body`). |
| 02/02/2026 | 3.22.0 | **Student-Safe Queries + Normalização TIPOS_USUARIO + Preview/Publish System**: `educacaoService.js` refatorado: `TIPOS_USUARIO` alinhado com SSOT de role keys (`anestesiologista`, `medico-residente`, `tec-enfermagem`, etc.), `USER_TYPE_ALIASES` para compatibilidade com dados antigos, funções `normalizeUserType()`/`normalizeUserTypes()`, `getVisibleEntities` normaliza automaticamente. **Student-Safe Queries**: 6 novas funções (`getTrilhasForStudent`, `getCursosForStudent`, `getModulosForStudent`, `getAulasForStudent`, `getConteudoCompletoForStudent`, `getTrilhaCompletoForStudent`) que usam arrays denormalizados (`publishedCursoIds`, etc.) em vez de junction tables, com chunking Firestore (max 10 IDs por query). **Visibilidade simplificada**: Trilha define visibilidade (auto: `tiposUsuario > 0` → RESTRICTED), filhos sempre INHERIT (removidos seletores manuais de StepTreinamento, StepModulo, StepAula). **StepAula refatorado**: campos específicos por tipo (youtube/vimeo → URL, video/audio/document → file upload, text → conteúdo), validação por tipo, bloco inicial com `pendingUpload` flag. **8 novos componentes admin**: `ContentPreviewInline` (preview inline com YouTube/Vimeo embed, video/audio player), `BannerUpload` (upload reutilizável de thumbnails), `PublishButton` (publicação com validação hierárquica e cascata), `SyncStatusPanel` (estatísticas DRAFT/PUBLISHED), `TreeNavigator`+`useTreeExpansion` (árvore navegável), `TreeBreadcrumb` (breadcrumb hierárquico), `PanelShell` (container com scroll), `PreviewModal` (student-safe com comparação admin/aluno). **AdminConteudoPage**: `BlockRenderer` com embeds inline (YouTube/Vimeo/video/audio/PDF), `RichTextSimple` refatorado com useRef (fix cursor). **CascadeCreator**: breakpoint 1024→768, prop `onComplete`, inicialização com `isInitialized`, recuperação de sessão com verificação de progresso real, cleanup localStorage na última etapa. **useEducacaoData**: novo método `forceRefreshFromFirestore()`. **Responsividade**: todos os Steps com layout mobile-first (`p-4 sm:p-6`, `flex-wrap`, `min-w-0`, `leading-tight`). Seções 26.15–26.22 documentam todas as alterações. |
| 28/01/2026 | 3.21.0 | **Sistema de Criação em Cascata + AdminConteudoPage**: Nova página `AdminConteudoPage` com layout 3 painéis (Navigator/Editor/Sidebar). Sistema `CascadeCreator` para criação guiada (Trilha → Treinamento → Módulo → Aula) com componentes de steps (`StepTrilha`, `StepTreinamento`, `StepModulo`, `StepAula`). `EntitySelector` permite anexar entidades existentes. `CascadeSummary` exibe resumo lateral. Persistência de sessão via localStorage. `ContinueSessionDialog` recupera sessões interrompidas. **Sistema de Visibilidade**: Novo modelo `INHERIT/PUBLIC/RESTRICTED` com herança hierárquica em `visibilityUtils.js`. Hook `useVisibilityCheck` para verificação de acesso. **useEducacaoData refatorado**: Sistema de relações (`trilhaCursosRel`, `cursoModulosRel`, `moduloAulasRel`), integração Firestore via `educacaoService`, sanitização de dados. **Novos componentes**: `ModulosTab`, `ReorderableList`, `NovoConteudoModal`, `TrilhaBanner`, `useEffectiveBanner`. **Terminologia**: "Curso" → "Treinamento" na UI. Seção 26 expandida com 14 subseções documentando todo o módulo de educação. |
| 27/01/2026 | 3.20.1 | **Fix EditDocumentModal em DocumentoDetalhePage**: Modal de edição reescrito para maior robustez. Correções: (1) Removido try-catch problemático no useState, (2) Adicionado fallbacks para TIPO_CONFIG e SETORES caso não disponíveis, (3) Verificação de document.body antes do createPortal, (4) Substituído componente Button por botões HTML nativos para evitar problemas, (5) Adicionado onClick no overlay para fechar ao clicar fora, (6) stopPropagation no conteúdo do modal, (7) Focus states nos inputs (focus:ring-2), (8) shadow-2xl para maior visibilidade, (9) type="button" em todos os botões. Sistema de permissões simplificado: Administrador = CRUD automático em todas funcionalidades com acesso. |
| 27/01/2026 | 3.19.0 | **Módulo de Educação (Admin) - Correções Críticas**: Corrigidos 5 bugs nos modais de admin. **CursoFormModal**: FileUpload props corrigidas (`onChange` em vez de `onFileSelect`), `uploadService.uploadBanner()` com entityId correto, React.Fragment trocado por `<div>` para evitar erro aria-describedby. **TrilhaFormModal**: adicionada prop `trilhas` para passar ao CursoFormModal aninhado. **TrilhasTab**: passa `trilhas={trilhas}` ao TrilhaFormModal. **AulaFormModal**: mesmas correções de FileUpload, usa `uploadService.uploadVideo/uploadAudio`. **Select (design-system)**: implementado portal pattern com `createPortal` para dropdown não ser cortado por overflow de modal, z-index 1300, click outside handler corrigido para considerar `dropdownRef` do portal. **uploadService**: adicionado mock automático em desenvolvimento sem autenticação (`shouldUseMock()` detecta `import.meta.env.DEV && !auth.currentUser`). Nova Seção 26 documenta todo o sistema. |
| 25/01/2026 | 3.18.1 | **EducacaoPage - Remoção da Seção Admin**: Removida seção "Administração" visível no EducacaoPage. Funções administrativas (Gestão de Conteúdo, Gerenciar Aulas, Gerenciar Trilhas, Relatórios) agora acessíveis **apenas** via dropdown do avatar em EducacaoContinuadaPage. Acesso controlado por `canManageContent(user)`. Imports removidos: `Card`, `CardContent`, `Settings`, `Video`, `GitBranch`, `BarChart3`, `ChevronRight`, `useUser`, `canManageContent`. EducacaoPage simplificada: apenas ComunicadosCard (Educação Continuada) + 2 WidgetCards (Desafio ROPs, Residência Médica). |
| 25/01/2026 | 3.18.0 | **DocumentsContext - Single Source of Truth**: Implementado sistema centralizado de documentos com Provider Pattern. Novos arquivos: `src/types/documents.js` (constantes e tipos), `src/contexts/DocumentsContext.jsx` (estado e reducer), `src/hooks/useDocuments.js`, `src/hooks/useDocumentsByCategory.js`, `src/hooks/useDocumentActions.js`. Centro de Gestão agora usa `useDocuments()` em vez de mocks locais. QualidadePage exibe contagens dinâmicas dos documentos. DocumentCard clicável navega para `documento-detalhe`. DocumentsLayout simplificado (removido grid de categorias redundante). DocumentoDetalhePage busca em `mockBibliotecaDocumentos`. Seção 25 documenta o sistema completo. |
| 21/01/2026 | 3.17.0 | **EticaBioeticaPage com Accordions**: Página de Ética e Bioética reescrita com layout de accordions. Novo arquivo `mockEtica.js` com 11 documentos mock nas 5 categorias (dilemas, parecerUti, diretrizes, emissaoParecer, codigoEtica). Componentes: `EticaSectionHeader` (accordion header com ícone, título, contador, chevron) e `EticaDocCard` (Card com Badge, título, código, versão). Badges com uma palavra: Dilemas, UTI, Diretrizes, Parecer, Codigo. Campo de busca com filtro. Contador de documentos. Accordions expandem ao buscar. `DocumentoDetalhePage` atualizado para buscar em `mockEticaDocumentos`. Novo tipo `etica` no tipoConfig com cor verde (#006837). Usa `eticaConfig.js` para configuração das categorias. |
| 19/01/2026 | 3.16.0 | **Aba Comitês no Centro de Gestão**: Nova aba "Comitês" adicionada ao PermissionsPage entre Auditorias e Stats. 9 tipos de comitês configurados em `comitesConfig.js`. 27 documentos mock em `mockComites.js`. 4 sub-tabs: Documentos (lista com busca/filtro), Categorias (grid de tipos), Arquivados (com restaurar), Stats (métricas). Novo componente `ComiteDocCard` idêntico ao `DocCardWithMenu` com menu de 3 pontos. Estados: `comitesSubTab`, `comitesSearchQuery`, `comitesFilterTipo`. Memos: `filteredComites`, `comitesStats`. Centro de Gestão agora com 8 abas totais. Seção 15.5 documenta a aba completa. |
| 19/01/2026 | 3.15.3 | **AuditoriaDocCardWithMenu na aba Auditorias > Documentos**: Novo componente `AuditoriaDocCardWithMenu` para cards de documentos na sub-aba "Documentos" da aba "Auditorias" em PermissionsPage. Segue padrão do `DocCardWithMenu` usado na aba "Documentos". Alterações: removido ícone circular grande à esquerda, badge de tipo + código na mesma linha, título com truncate, metadados (versão, responsável, data), tags (até 3), menu de 3 pontos (⋮) com dropdown (Editar, Nova Versão, Histórico, Arquivar), clique no card navega para detalhes. Borda vermelha à esquerda para documentos vencidos. Arquivo: `src/pages/PermissionsPage.jsx` (linhas ~980-1098 componente, ~3458-3486 uso). |
| 19/01/2026 | 3.15.2 | **Fix Widgets ROPs Vazios no Showcase**: Corrigido bug onde os widgets das ROPs no Showcase/Design System exibiam "Área não encontrada" com `areaKey: "undefined"`. Causa: `PagesShowcase.jsx` não passava as props `areaKey` e `ropKey` para os componentes de ROPs. Solução: adicionadas props `areaKey={pageParams?.areaKey}` e `ropKey={pageParams?.ropKey}` na renderização do `PageComponent`. Arquivo: `src/design-system/showcase/PagesShowcase.jsx` (linha ~864-866). |
| 19/01/2026 | 3.15.1 | **Fix Card de Férias (Pega Plantão)**: Corrigido bug onde o card de férias não exibia os profissionais. A API retorna férias dentro do endpoint de plantões com `Setor = "Férias"`. Solução: extrair férias diretamente dos plantões antes do processamento, filtrar `plantoesReais` para o loop principal, remover código morto de busca via `getAfastamentosAtivos()`. Arquivo: `src/services/pegaPlantaoApi.js`. Nova subseção 22.10 documenta a solução. |
| 19/01/2026 | 3.15.0 | **Sistema de Documentos de Ética**: Implementado gestão completa de documentos PDF nas 5 sub-páginas de Ética e Bioética. Novo hook `useEticaDocumentos` com `loadDocumento`, `uploadDocumento`, `deleteDocumento`. Configuração em `eticaConfig.js` com 5 categorias (dilemas, parecerUti, diretrizes, emissaoParecer, codigoEtica). Componente `UploadDocumentoModal` para upload de PDFs. PDF exibido inline na página via `PDFViewer` (sem botão "Visualizar"). Metadados do documento (título, data, autor, tamanho). Controle de acesso admin via `AdminOnly`. 5 coleções Firestore criadas. Query otimizada com filtragem/ordenação client-side para evitar índices compostos. |
| 19/01/2026 | 3.14.0 | **DesastresPage - Seção Siglas**: Adicionado widget "Siglas" com 10 abreviações e seus significados (CGPED, SESMT, CCIH, CC, UTI, SRPA, SAMU, EPIs, TI, PCR). Removido banner vermelho do topo da página. DesastresPage agora possui 3 seções: Emergências em Andamento (6), Planos e Fluxos (4), e Siglas (10). Todos os protocolos de emergência foram migrados do app legado com conteúdo completo. |
| 18/01/2026 | 3.12.1 | **Fix EditEstagiosModal Layout**: Modal de edição do card "Estágios Residência" corrigido. Adicionado `max-h-[60vh] overflow-y-auto` ao `Modal.Body` para controlar altura e permitir scroll interno. Aumentado tamanho do modal de `lg` para `xl`. Arquivo: `src/components/residencia/EditEstagiosModal.jsx`. Padrão seguido do `OrgEditModal`. |
| 18/01/2026 | 3.12.0 | **Hierarquia Visual Header + Gestão de Residentes**: Avatar aumentado para 52px e sino reduzido para 44px criando hierarquia visual (identidade > ação utilitária). Baseado em pesquisa de UI/UX: avatares devem dominar visualmente o header. Arquivos alterados: `avatar.jsx` (lg: 52px), `header.jsx` (sino: 44px). **GerenciarResidenciaPage**: Funcionalidade de adicionar/excluir residentes em desenvolvimento. Hook `useResidencia` e `residenciaService` gerenciam dados no Firestore (collection `residencia/estagios`). |
| 18/01/2026 | 3.11.0 | **Formulários Públicos e QR Codes Funcionais**: Componente `qr-code.jsx` reescrito usando biblioteca `qrcode` (npm) para gerar QR codes reais e escaneáveis. Formulários HTML públicos (`formulario-incidente.html`, `formulario-denuncia.html`) agora integrados com Firebase - salvam dados diretamente no Firestore. Upload de anexos em denúncias via Firebase Storage. Storage rules atualizadas para permitir upload público na pasta `denuncias/`. Nova Seção 24 documenta o sistema completo. |
| 18/01/2026 | 3.10.0 | **Sistema de Organograma Interativo**: Novo módulo completo em `src/components/organograma/` com 8 componentes. Accordion expansível com linhas conectoras visuais (`border-l-2`). 7 tipos de nós com cores específicas (governance, executive, technical, admin, committee, operational, advisory). Persistência no Firebase (collection `configuracoes`). Modal de edição com suporte a múltiplos responsáveis/emails. Bottom sheet de detalhes redesenhado. Hook `useOrganograma()` para CRUD. Cards compactos e simétricos. Comitês consultivos com borda tracejada. Seção 23 documenta o sistema completo. |
| 17/01/2026 | 3.9.0 | **Integração API Pega Plantão**: Novo serviço `pegaPlantaoApi.js` com OAuth 2.0, cache e endpoints. Hook `useEscalaDia()` para consumo de dados de plantões. Card Plantões na HomePage limitado a 4 itens com "Ver todos". Nova página `EscalasPage` exibindo todos os plantonistas do dia. Fins de semana: apenas escala diurna. Dias úteis: card Férias Programadas. PlantaoListItem com nomes mais destacados (font-bold, cor #004225). Proxy Vite configurado para CORS. Seção 22 documenta a integração completa. |
| 16/01/2026 | 3.6.1 | **Widget Reuniões**: Adicionado novo widget "Reuniões" na GestaoPage. Ícone Users, subtítulo "Gestão de reuniões", navega para 'reunioes'. GestaoPage agora com 4 widgets (Qualidade, Financeiro, Escalas, Reuniões). |
| 16/01/2026 | 3.6.0 | **Scroll to Top on Navigation**: Fix para páginas abrindo no meio em vez do topo. Adicionado `useEffect` com `window.scrollTo` em App.jsx (watch `currentPage`) e `useRef` + `useEffect` em PagesShowcase.jsx para scroll no container interno. Seção 20.8 documenta o padrão. |
| 16/01/2026 | 3.5.0 | **Sistema de Histórico de Navegação**: Implementado `navigationHistory` stack em App.jsx e PagesShowcase.jsx. Função `goBack()` permite voltar para página anterior como botão do navegador. **Fix ProfilePage**: Corrigido crash de página em branco quando `user` é null - hooks movidos para antes do early return, form inicializado vazio, Avatar com optional chaining. Seção 20.6 e 20.7 documentam os padrões. |
| 16/01/2026 | 3.4.0 | **Sub-páginas de Qualidade (35 novas)**: Criadas 6 pastas de sub-páginas: `kpi/` (6), `comites/` (9), `etica/` (5), `auditorias/` (5), `relatorios/` (3), `desastres/` (10). Todas seguem padrão DS com header fixo via `createPortal`. Seção 13.1.1 com documentação completa. Seção 16.1 atualizada para 64 páginas. |
| 16/01/2026 | 3.3.0 | **Padrões de Navegação React**: Nova Seção 20 documentando padrão KEY prop + Lazy State Initialization para preservar estado de abas ao navegar entre páginas. **Sistema de Arquivamento**: Nova Seção 21 documentando funcionalidade de arquivar/restaurar documentos. Sub-aba "Arquivados" em PermissionsPage. Implementado em App.jsx, PermissionsPage.jsx, DocumentoDetalhePage.jsx. |
| 14/01/2026 | 3.2.0 | **Header Fixo com createPortal**: Implementado header fixo em 29 páginas usando `createPortal` do React. Header renderizado via Portal para `document.body`, garantindo `position: fixed` funcional. Padrão inline em cada página (sem componente centralizado). Seção 16.1 completamente reescrita. |
| 13/01/2026 | 3.1.0 | **InfoBox redesign**: 5 seções visuais (warnings, doses, keyPoints, interpretation, reference). Migração de 76+ calculadoras de `warning: 'string'` para `warnings: ['array']`. Nova Seção 10.6 documentando estrutura. |
| 12/01/2026 | 3.0.0 | Adicionado MCPs (Seção 18) e Fases do Projeto (Seção 19) |
| 11/01/2026 | 2.6.0 | Sistema documental completo, Centro de Gestão inicial |
| 10/01/2026 | 2.5.0 | BibliotecaPage grid 2 colunas, DocumentoDetalhePage |
| 09/01/2026 | 2.4.0 | PageHeader com rightContent |

---

*Este documento é a fonte da verdade para o desenvolvimento do ANEST Design System.*
*Atualize sempre que completar uma fase ou adicionar novos padrões.*
