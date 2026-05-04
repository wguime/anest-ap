# Incidents — Padrões Locais

> Veja parent rules: `lgpd`, `audit-trail`, `padroes-codigo` (auto-aplicadas).

## Padrões CRUD desta área
- Páginas seguem padrão: `IncidentesPage.jsx` (lista) → `IncidenteDetalhePage.jsx` (detalhe) → `NovoIncidente*` (form)
- Mesmo padrão para denúncias: `DenunciaGestaoPage` → `DenunciaDetalhePage` → form público em `public/formulario-denuncia.html`
- Service: `src/services/supabaseIncidentsService.js`
- Context: `src/contexts/IncidentsContext.jsx` (1233 linhas — reducer + realtime subscription)
- Realtime: usa `createReliableSubscription` (helper canônico)

## Anonimização (LGPD obrigatório)
- Campo `isAnonimo` controla coleta de identidade
- Uma vez anonimizado, identidade é **IMUTÁVEL** (nunca permita reverter)
- Tracking público via código `ANEST-YYYY-XXXXXX` (sem identificação pessoal)

## Permissões
- Verificar entry em `PAGE_TO_CARD['incidentes']` em `src/App.jsx`
- Public forms (`public/formulario-incidente.html`, `public/formulario-denuncia.html`):
  - Firestore rule: `allow create: if true; allow read,update,delete: if isAuthenticated();`
- Ownership validation nas páginas de detalhe (impede ver incidente alheio)

## Ao adicionar feature
1. Atualizar `incidentesResponsaveis.js` se introduz novo tipo
2. Audit trail OBRIGATÓRIO em mutations: `changedBy = currentUserId` (NUNCA hardcoded)
3. Considerar invocar `@lgpd-reviewer` antes de commit em mudanças de fluxo de dados
4. Se mudar policy Firestore/Supabase, invocar `@security-reviewer`
