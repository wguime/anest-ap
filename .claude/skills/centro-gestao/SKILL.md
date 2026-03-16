---
name: centro-gestao
description: Centro de Gestão administrativo. 9 abas, ManagementLayout, permissões simplificadas (card toggle + admin flag), audit trail, sync Firebase↔Supabase.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Centro de Gestão ANEST

## Quando Usar
Editar CentroGestaoPage, ManagementLayout, PermissionsModal. Trabalhar com abas, UsersManagementContext, supabaseUsersService.

## 9 Abas
| Aba | Ícone | Conteúdo |
|-----|-------|----------|
| Usuários | Users | CRUD, permissões, audit |
| Emails | Mail | Emails autorizados |
| Documentos | FileText | 6 sub-seções (ética, comitês, auditorias, relatórios, biblioteca, financeiro) |
| Auditorias | Shield | Audit trail |
| Comitês | Briefcase | 9 tipos de comitê |
| Estatísticas | BarChart3 | Métricas |
| Comunicados | MessageSquare | 3 tabs (rascunho, aprovado, publicado) |
| Incidentes | AlertTriangle | Gestão interna |
| Residência | User | Gestão residentes |

## Permissões Simplificadas (v3.20.0)
```
Toggle Card ON = Acesso/Visibilidade
Admin flag = CREATE/EDIT/DELETE automático em tudo acessível
```

## NAV_STRUCTURE (5 seções, 38 cards)
| Seção | Cards |
|-------|-------|
| HOME | 10 |
| GESTÃO | 22 |
| DASHBOARD | 1 |
| EDUCAÇÃO | 3 |
| MENU | 2 |

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

## 9 Tipos de Comitê
regimento_interno (#2563eb), executivo (#059669), financeiro (#059669), gestao_pessoas (#7c3aed), escalas (#f59e0b), tecnologia (#2563eb), qualidade (#2563eb), educacao (#dc2626), etica_conduta (#7c3aed)

## Integrações
- UserContext (isAdministrator, isCoordenador)
- Firestore + Supabase (sync bidirecional)
- Todos os módulos (cada aba integra seu respectivo módulo)
