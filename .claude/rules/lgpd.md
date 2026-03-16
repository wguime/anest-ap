---
globs: ["src/pages/incidents/**", "src/services/lgpd*", "src/contexts/Incidents*", "src/pages/management/users/**", "src/services/supabaseUsers*", "src/contexts/UsersManagement*", "supabase/migrations/**"]
description: Conformidade LGPD — consentimento, anonimização, retenção de dados pessoais de saúde
---

# LGPD Compliance — ANEST

## Consentimento
- Consentimento condicional no primeiro login via PrivacyPolicyModal (11 seções)
- Checkbox obrigatório antes de submeter incidente/denúncia
- Coleta condicional de userId (opt-in)
- Coleta condicional de gênero em denúncias

## Anonimização
- Incidentes: campo `isAnonimo` controla se identidade é coletada
- Denúncias: identidade protegida, tracking via código `ANEST-YYYY-XXXXXX`
- Uma vez anonimizado, identidade é IMUTÁVEL (não pode ser revertida)
- Ownership validation nas páginas de detalhe

## Retenção de Dados
- `infra_health_history`: retenção 90 dias (DELETE automático)
- Dados de saúde: seguir regulamentação CFM para prontuários

## Solicitações LGPD
- 3 tipos: export, deletion, portability
- Per-source tracking de consentimento
- DS Green uniforme (#059669) para todas as ações LGPD
- Painel de solicitações no Centro de Gestão

## Formulários Públicos
- `public/formulario-incidente.html` e `public/formulario-denuncia.html`
- Sem autenticação (create público), leitura requer auth
- Firestore rules: `allow create: if true; allow read, update, delete: if isAuthenticated();`

## Ao Criar Novas Features com Dados Pessoais
1. Verificar necessidade de consentimento
2. Implementar opção de anonimização quando aplicável
3. Definir política de retenção
4. Documentar base legal LGPD
5. Garantir que dados sensíveis de saúde têm proteção adicional
