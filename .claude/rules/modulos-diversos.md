---
paths:
  - "src/pages/communication/**"
  - "src/pages/ProfilePage.jsx"
  - "src/pages/EscalasPage.jsx"
  - "src/pages/escalas/**"
  - "src/pages/residencia/**"
  - "src/pages/reunioes/**"
  - "src/pages/noticias/**"
  - "src/pages/NoticiasPage.jsx"
  - "src/pages/planos-acao/**"
  - "src/pages/auditorias*/**"
  - "src/pages/autoavaliacao/**"
  - "src/pages/kpi/**"
  - "src/pages/relatorios/**"
  - "src/pages/rops/**"
  - "src/pages/PendenciasPage.jsx"
  - "src/pages/SearchResultsPage.jsx"
  - "src/pages/dashboard/**"
  - "src/pages/RefeicaoUnimedPage.jsx"
  - "src/contexts/NoticiasContext.jsx"
  - "src/contexts/MessagesContext.jsx"
  - "src/lib/escalaFuncionariasDocx.js"
  - "src/lib/staffMedicalLeaves.js"
description: Módulos sem seção própria — mensagens, perfil, escalas & trocas, residência, notícias, qualidade (planos/auditorias/ROP/KPI), busca, pendências, dashboard
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto). Texto VERBATIM da tabela
     "Mapa de Módulos" — nenhuma linha foi editada ou resumida. O CLAUDE.md guarda a versão
     de uma linha por módulo; o detalhe (gotchas, decisões do dono) está aqui. -->

# Mapa de Módulos — detalhe integral

| Mensagens internas | `src/pages/communication/` (Inbox, MessageDetail) | `MessagesContext` + `supabaseMessagesService` → tabela `messages` | Threads c/ respostas; `createSystemNotification` é a ponte de notificação usada por todos os módulos. ⚠️ Lista da inbox usa `<div>` simples, **não** `AnimatedList`: o wrapper `layout` do framer movia a linha sob o dedo entre press/release → 1º clique não registrava ("fica parado na lista"), só em prod c/ dados reais (cliques atômicos do Playwright não reproduzem). Fix 956aedd |
| Meu Perfil | `src/pages/ProfilePage.jsx` (rota `/profile`) | Firestore `userProfiles` (fonte da verdade; `crm`/`especialidade` são **Firestore-only**, sem coluna no Supabase `profiles`) + `updateUser` sincroniza só `nome` p/ Supabase | Estrutura (best-practice pesquisada): Identidade (avatar + credenciais **CRM · especialidade** + **1 cargo** admin>coord>role) → Mensagens (atalho discreto) → Conta e Segurança → Modo Escuro → Administração (admin) → LGPD → Sair. ⚠️ **Gotcha save silencioso:** Firestore tem persistência offline (`persistentLocalCache`) → `updateDoc` resolve no cache e mostra toast de "sucesso" mesmo se a escrita do servidor for rejeitada (sessão/token Firebase degradado) → o valor some ao recarregar (`updateTime` do doc no servidor não muda). **Re-login renova o token e resolve.** |
| Escalas & Trocas | EscalasPage, EscalasFuncionariasHubPage, `Trocas*Page` | Firestore: `trocas_plantao`/`trocas_sobreaviso`/`trocas_plantao_hospitalar` + overrides diários (`residenciaPlantaoDiario`, `sobreavisoMaternoDiario`, `hospitaisDiario`) | Códigos TR/SB/PH#####; aceitar troca grava override do dia; identidade resolvida por email. **Base funcionárias é DINÂMICA (31/07):** docx mensal importado in-app (Hub → Importar, parser `src/lib/escalaFuncionariasDocx.js`) publica `escalasFuncionarias/{YYYY-MM}` (write = `hasEscalasEditPermission`) — mês publicado SUBSTITUI o mês inteiro do estático via registro `BASE_ATIVA` em `src/data/*2026.js` (abr–ago/2026 = fallback congelado; `EscalasFuncionariasBaseContext` publica `version` p/ re-render); cron `enviarLembretesEscala` 18h lê a coleção (dedup compartilhada c/ o hook client: sufixo `1day`/`1day-d0`). **Atestado = "ATESTADO" na escala (dono 08/08):** o rótulo público vem do `PUBLIC_PLACEHOLDER` de `src/lib/staffMedicalLeaves.js` — **fonte ÚNICA**; `staffMedicalLeaveService` importa em vez de repetir o texto (repetia "INDISPONÍVEL" à mão, e documento público × projeção admin divergiam para o mesmo dado). Mostra só o motivo operacional: sem datas, sem diagnóstico, sem nome de quem cobre — dado de saúde, art. 11 LGPD. |
| Residência | ResidenciaHubPage, GerenciarResidenciaPage | `useResidencia` + `residenciaEstagiosDiariosService` (Firestore) | Estágios rodam a cada 15 dias, rollover 07h, pula FDS/feriados; ver `docs/residencia.md` |
| Reuniões | `src/pages/reunioes/` | `reunioesService` | Detalhe com 6 tabs (contexto, check-in, presença, docs, histórico, deliberações) |
| Notícias | NoticiasPage / NoticiaDetalhe / CategoriaNoticias | `NoticiasContext` → tabela `noticias`; Edge `fetch-noticias` (PubMed E-utilities) | 4 journals; dedup trigram + DOI. **Curadoria de destaques (15/08):** `curadoria_por`+`curadoria_destaque_ate` (migration `20260815210000`) seguram o artigo indicado no TOPO dos destaques até o prazo, com badge "Curadoria {nome}" — lib pura `src/lib/noticiasDestaques.js` ordena curadoria ativa antes do `final_score`, `fetchHighlights` busca curados fora do top-10 e o recompute semanal re-marca `is_featured` (sem o passo extra o cron de segunda derrubava a curadoria). Artigo de journal fora do cron entra por INSERT em migration — DOI SEMPRE minúsculo (convenção da edge; índice único é case-sensitive). Badge no verde padrão do DS (`default` subtle, dono 16/08). PDF completo (só licença CC-BY — a URL é pública): arquivo em `public/artigos/*.pdf` + `oa_pdf_url` RELATIVO (`/artigos/...`) — URL relativa renderiza no **PDFViewer da gestão documental** (react-pdf, Suspense local obrigatório); URL externa (PMC) segue no iframe `PDFEmbed`. O bucket `noticias-artigos` (20260816120000) ficou VAZIO/sem uso: upload exigia service_role e o agente é barrado — hosting serve o arquivo antes do rewrite e funciona em dev e prod. 1ª curadoria: Dr. Humberto Hepp, 3 artigos até 14/09/2026 |
| Qualidade (hub) | QualidadePage | agrega módulos abaixo via `useCardPermissions` | |
| Planos de Ação | `src/pages/planos-acao/` | `PlanosAcaoContext` → `planos_acao` | Ciclo PDCA + avaliação de eficácia |
| Auditorias | `src/pages/auditorias{,-interativas}/` | `AuditoriasInterativasContext` → `auditoria_execucoes` | Templates em `src/data/auditoriaTemplatesConfig.js`; status rascunho/em_andamento/concluida |
| Autoavaliação ROP | `src/pages/autoavaliacao/` | `AutoavaliacaoContext` → `autoavaliacao_rop` | Ciclos; 4 status de conformidade |
| KPIs | `src/pages/kpi/` | `supabaseKpiService` → `kpi_dados_mensais` | Entrada manual mensal |
| Relatórios | `src/pages/relatorios/` | `supabaseRelatoriosService` → `relatorios_qualidade` | |
| ROPs quiz | `src/pages/rops/` | `supabaseROPsService` → `rop_areas`/`rop_subdivisoes`/`rop_questions`/`rop_user_attempts` | 640 questões (32 ROPs × 20) |
| Pendências | PendenciasPage | agrega comunicados não-lidos + docs vencidos + ROPs pendentes | |
| Busca global | SearchResultsPage + `AppCommandPalette` | `supabaseSearchService` | 15+ tipos; atalhos custom via PersonalizarAtalhosPage |
| Faturamento | `src/pages/faturamento/` | `src/data/cbhpmData.js` (12 portes CBHPM 2020) | **Em construção** — páginas placeholder |
| Dashboard executivo | `src/pages/dashboard/` | `useDashboardExecutivo` | Oculto da nav; admin-only; 21+ KPIs |
| Refeição Unimed | card em MenuPage → `src/pages/RefeicaoUnimedPage.jsx` | externo (form Hoobox, embed iframe) | Rota interna `/refeicao-unimed`; URL fixa do QR do mural (Unimed Chapecó); abre no app, não em aba externa; sem gate de permissão |
