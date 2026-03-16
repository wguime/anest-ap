# Planos de Ação — ANEST

## Metodologia PDCA
Plan → Do → Check → Act

## Páginas
| Página | Arquivo | Descrição |
|--------|---------|-----------|
| PlanosAcaoPage | planos-acao/PlanosAcaoPage.jsx | Lista com tabs (Dashboard, Lista, Novo) |
| PlanoAcaoDetalhePage | planos-acao/PlanoAcaoDetalhePage.jsx | Detalhe com timeline e etapas PDCA |
| NovoPlanoPage | planos-acao/NovoPlanoPage.jsx | Criação de novo plano |

## Componentes
| Componente | Descrição |
|-----------|-----------|
| PlanoAcaoDashboard | Dashboard com DonutChart por status, filtros, navegação para lista |
| PlanoAcaoCard | Card individual com status, prioridade, responsável, prazo |
| PdcaStepper | Stepper visual das 4 etapas PDCA (Plan/Do/Check/Act) |
| EficaciaEvaluation | Avaliação de eficácia do plano após conclusão |

## Status do Plano
| Status | Cor | Etapa PDCA |
|--------|-----|------------|
| planejamento | azul | Plan |
| em_andamento | amarelo | Do |
| verificacao | roxo | Check |
| concluido | verde | Act |
| cancelado | vermelho | — |

## Dados (Supabase)
- Service: `src/services/supabasePlanosAcaoService.js`
- Context: `src/contexts/PlanosAcaoContext.jsx`
- Config: `src/data/planosAcaoConfig.js`
- Mock: `src/data/mockPlanosAcao.js`

## DonutChart
- Distribuição por status no PlanoAcaoDashboard
- Click no segmento → filtra lista por status
- Legenda click = highlight visual (sem navegação)

## Dashboard Executivo
- Seção "Planos PDCA" no DashboardExecutivoPage
- DonutChart com taxas de conclusão e eficácia
- Breakdown por status e origem
- PDF export inclui seção planos PDCA com drawProgressBar

## Integração
- Dashboard Executivo → DonutChart com status PDCA
- Qualidade → métricas de planos ativos (useQualidadeDashboard)
- Centro de Gestão → relatórios de ação
- Auditorias → planos gerados a partir de findings
- useDashboardExecutivo → agrega dados de planos
