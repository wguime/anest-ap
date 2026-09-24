---
paths:
  - "src/services/**"
description: Padrão de audit trail — toda mutation Supabase deve incluir logging
---

# Audit Trail — ANEST

## Regra Principal
Toda mutation (insert, update, delete) no Supabase DEVE incluir audit trail.

## changedBy
SEMPRE usar `currentUserId` real do contexto de autenticação.
NUNCA usar strings hardcoded como `'admin'` ou `'system'`.

## Custom Permissions Audit
Alterações em permissões de usuário devem gerar log com:
- userId alvo
- permissão alterada
- valor anterior → novo valor
- changedBy (quem alterou)

## Padrão de Implementação
Na fronteira de toda mutation, `requireUserId` de `@/utils/audit`: lança `MissingUserIdError` sem uid,
e o chamador mostra toast/re-auth em vez de gravar trilha forjada. Log de permissão:
`logPermissionChange` em `src/services/supabaseUsersService.js` (o `fetchAuditLog` do mesmo arquivo é a
LEITURA que alimenta a aba de auditoria).

## AuditTrailModal
- Filtros: ação + período
- ChangeLogTimeline: tempo relativo (há X minutos/horas)
- Localização: Centro de Gestão → aba Usuários
