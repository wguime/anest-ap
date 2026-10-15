---
paths:
  - "src/pages/incidents/**"
  - "src/pages/management/lgpd/**"
  - "src/services/lgpd*"
  - "src/contexts/Incidents*"
  - "src/pages/management/users/**"
  - "src/services/supabaseUsers*"
  - "src/contexts/UsersManagement*"
  - "public/formulario-*.html"
  - "supabase/migrations/**"
  - "src/lib/sessaoSalva.js"
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
- Cópia local do perfil (`src/lib/sessaoSalva.js`, 15/10/2026): só o próprio usuário, só com "Manter
  conectado", apagada no Sair, ignorada após 30 dias parada (linha em `docs/lgpd-retencao.md`). Campo novo
  de aparelho/segredo em `userProfiles` entra em `CAMPOS_FORA` — texto com nome de token/senha/chave já sai

## Solicitações LGPD
- 3 tipos: export, deletion, portability
- Per-source tracking de consentimento
- Cor das ações LGPD por token semântico, como no resto do app (a aba de solicitações usa `bg-success`);
  `#059669` só aparece como variável CSS de sucesso nos `public/formulario-*.html`, que têm CSS próprio
- Painel de solicitações no Centro de Gestão

## Formulários Públicos
- `public/formulario-incidente.html` e `public/formulario-denuncia.html`
- Sem autenticação: gravam via `rpc_submit_public_incident` (Supabase, SECURITY DEFINER, anon)
- Firestore `incidentes`/`denuncias` são coleções LEGADAS travadas (`allow read, write: if false`, 05/09/2026)
- Leitura de relatos: SÓ responsável marcado no Centro de Gestão (`is_incident_responsible`), nunca por ser admin

## Ao Criar Novas Features com Dados Pessoais
1. Verificar necessidade de consentimento
2. Implementar opção de anonimização quando aplicável
3. Definir política de retenção
4. Documentar base legal LGPD
5. Garantir que dados sensíveis de saúde têm proteção adicional
