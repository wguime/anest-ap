---
globs: ["src/services/**"]
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
Seguir pattern em: `src/services/supabaseUsersService.js:fetchAuditLog`

## AuditTrailModal
- Filtros: ação + período
- ChangeLogTimeline: tempo relativo (há X minutos/horas)
- Localização: Centro de Gestão → aba Usuários
