# ANEST v3.70.0 — Gestão de Qualidade para Anestesiologia

## Regra #1
SEMPRE pesquisar nos MCPs (context7, shadcn, firecrawl) ANTES de implementar código.

## Stack
React 19.2 | Vite 7.2 | Tailwind 3.4 | Framer Motion 12 | Firebase 12.7 (Auth) | Supabase 2.95 (DB)

## Arquitetura
- Auth: Firebase Auth → Edge Function → Supabase JWT (HS256, cache 50min, refresh 10min)
- Data: Supabase (negócio) + Firestore (perfis) — sync via reconcileFromSupabase
- Nav: Switch-based em App.jsx (NÃO react-router), history stack, goBack()
- Real-time: createReliableSubscription() com retry exponencial
- Contextos: UserProvider → AuthGatedProviders → DeferredProviders (2s delay)

## Convenções Essenciais
- Cores: SEMPRE DS tokens via cn() — NUNCA hex hardcoded
- Temas: Light + Dark OBRIGATÓRIOS (dual theme)
- Mobile-first, WCAG 2.1 AA, touch targets 44x44px
- Componentes: src/design-system/components/ui/ (57) + anest/ (24)
- Tokens: src/design-system/Tokens.json (fonte de verdade)
- Header fixo: createPortal em cada página
- Animações: Framer Motion com prefers-reduced-motion

## Comandos
npm run dev | npm run build | npm run preview
firebase deploy --only hosting:anest-ap

## Bottom Nav (5 abas)
Home | Gestão (Shield) | Dashboard | Educação | Menu

## Skills Disponíveis
/calculadoras — Criar/editar calculadoras clínicas (76+)
/educacao — Módulo educação (trilhas, ROPs quiz, certificados, admin)
/gestao-documental — Documentos (biblioteca, versionamento, compliance)
/centro-gestao — Admin center (9 abas, permissões, audit trail)
/nova-pagina — Como adicionar nova página ao app
/supabase-migration — Adicionar tabela/service/context Supabase

## Rules Automáticas (carregadas por path)
design-tokens — Paleta cores, z-index, tokens (*.jsx, *.css)
responsividade — Breakpoints, touch targets, mobile layouts
navegacao — KEY+lazy, goBack, PAGE_TO_CARD (App.jsx, pages/)
lgpd — Consentimento, anonimização, retenção (incidents/, users/)
qmentum-compliance — Ciclo documental, aprovação (management/documents/)
supabase-firebase — JWT flow, RLS, field mapping (config/, services/)
padroes-codigo — Estrutura componente, imports, error handling
audit-trail — Logging de mutations (services/)

## Referências em docs/
escalas-plantoes, organograma, formularios-publicos, etica-comites,
residencia, incidentes-denuncias, comunicados-inbox, faturamento,
desastres, planos-acao, project-phases
