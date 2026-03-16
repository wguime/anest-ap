# Faturamento — ANEST

## Páginas
| Alias App.jsx | Página | Função |
|---------------|--------|--------|
| faturamento | FaturamentoPage | Hub navegação |
| faturamentoDashboard | FaturamentoDashboardPage | Métricas + charts |
| faturamentoEventos | EventosPage | Listagem com filtros |
| faturamentoNovoEvento | NovoEventoPage | Form CBHPM |
| faturamentoEventoDetalhe | EventoDetalhePage | Detalhe status/paciente/procedimento |
| faturamentoNotas | NotasPage | Listagem com filtros |
| faturamentoNovaNota | NovaNotaPage | Form com eventos + auto-cálculo |
| faturamentoNotaDetalhe | NotaDetalhePage | Detalhe com eventos vinculados |
| faturamentoConvenios | ConveniosPage | Gestão convênios |

## Context & Hooks
- `FaturamentoProvider` (wrapper obrigatório) — `src/contexts/FaturamentoContext.jsx`
- `useEventos()` — Listagem/filtros eventos
- `useEvento(eventoId)` — Detalhe individual
- `useNotas()` — Listagem/filtros + `createNota()`
- `useCadastros()` — `convenioOptions`
- `formatarMoeda()` — Formatação BRL (`src/data/cbhpmData.js`)
- `STATUS_EVENTO`, `STATUS_NOTA` — Constantes com cores

## 6 Tipos Financeiro (FinanceiroSection)
| Tipo | Cor |
|------|-----|
| orcamento | #2E7D32 |
| relatorio_financeiro | #1565C0 |
| contrato | #7B1FA2 |
| auditoria_fiscal | #00838F |
| nota_fiscal | #EF6C00 |
| prestacao_contas | #C62828 |

## Integração
- Centro de Gestão → aba Documentos → seção Financeiro
- DocumentsContext → contagem financeiro
- Dashboard Executivo → métricas financeiras
