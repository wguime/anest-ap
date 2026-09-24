---
name: centro-gestao
description: Centro de Gestão administrativo (ManagementLayout com seções de usuários, documentos, comunicados, incidentes, residência, educação, funcionários e painel; permissões por card + flag admin; audit trail; sync Firebase↔Supabase). Use ao mexer no CentroGestaoPage, ManagementLayout, PermissionsModal, NAV_STRUCTURE (rolePermissionTemplates), UsersManagementContext ou supabaseUsersService.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Centro de Gestão ANEST

## Quando Usar
Editar CentroGestaoPage, ManagementLayout, PermissionsModal. Trabalhar com abas, UsersManagementContext, supabaseUsersService.

## Seções
A navegação vive em `NAVIGATION_ITEMS` (`ManagementLayout.jsx`), com grupos e subitens; cada id
folha é um `case` de `renderContent()` no `CentroGestaoPage.jsx`. Documentos tem 6 sub-seções
(ética, comitês, auditorias, relatórios, biblioteca, financeiro).

## Permissões Simplificadas (v3.20.0)
```
Toggle Card ON = Acesso/Visibilidade
Admin flag = CREATE/EDIT/DELETE automático em tudo acessível
```

## NAV_STRUCTURE
Seções (home, gestão, dashboard, educação, menu) e cards de permissão em `NAV_STRUCTURE`
(`src/data/rolePermissionTemplates.js`). Card novo entra ali e no template de cada papel: o teste
`escalaGatePublicacao.test.js` quebra quando um card fica sem chave — chave faltando vira acesso liberado.

## PermissionsModal
- Container: `max-h-[85vh]`
- Dropdown de perfil (preset)
- Accordions por seção NAV_STRUCTURE
- PermissionCard com toggle por card
- Admin toggle ao final
- Referência: `src/pages/management/components/PermissionsModal.jsx`

## Sync Firebase ↔ Supabase
Salvar em AMBOS:
- Supabase: via `contextUpdateUser` (dados de negócio)
- Firestore: via `updateDoc` (perfil)

## Guard de Acesso
Requer `isAdmin` OU `isCoordenador` para acessar Centro de Gestão.

## Real-time Subscriptions
- `authorized_emails` — badge de status conexão
- `lgpd_solicitacoes` — badge de status conexão

## Audit Trail
- **AuditTrailModal**: filtros por ação + período
- **ChangeLogTimeline**: tempo relativo
- changedBy: SEMPRE userId real (nunca hardcoded)

## Tipos de Comitê
Tipos e cores em `src/data/comitesConfig.js`.

## Integrações
- UserContext (`isAdmin`, `isCoordenador`)
- Firestore + Supabase (sync bidirecional)
- Todos os módulos (cada aba integra seu respectivo módulo)
