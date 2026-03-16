---
name: gestao-documental
description: Gestão documental. Biblioteca com accordions, 9 tipos com cores, versionamento, aprovação, arquivamento. Design unificado v3.15.2.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Gestão Documental ANEST

## Quando Usar
Criar/editar documentos, modificar tipos ou cores, trabalhar com versionamento/aprovação, editar BibliotecaPage, DocumentoDetalhePage, GestaoDocumentalPage.

## Arquitetura — 3 Implementações + Detalhe Unificado
- **BibliotecaPage** — Biblioteca com accordions por tipo
- **RelatoriosPage** — Relatórios com design unificado
- **GestaoDocumentalPage** — Gestão no Centro de Gestão
- **DocumentoDetalhePage** — Visualização unificada (docs E relatórios)

## Design Unificado
Stats Grid → Título → SearchBar → SectionHeader (accordions) → Grid 2 cols DocumentoCard → InfoFooter

## 9 Tipos de Documento (TIPO_CONFIG)
| Tipo | Cor | Ordem |
|------|-----|-------|
| protocolo | #059669 | 1 |
| politica | #6366F1 | 2 |
| formulario | #F59E0B | 3 |
| manual | #EC4899 | 4 |
| relatorio | #3B82F6 | 5 |
| processo | #8B5CF6 | 6 |
| termo | #14B8A6 | 7 |
| risco | #DC2626 | 8 |
| plano | #0891B2 | 9 |

## 3 Tipos de Relatório (RELATORIO_TIPO_CONFIG)
| Tipo | Cor |
|------|-----|
| trimestral | #3B82F6 |
| incidentes | #DC2626 |
| indicadores | #059669 |

## Navegação Unificada
```javascript
onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'biblioteca' });
// returnTo: 'biblioteca' | 'relatorios' | 'centro-gestao' | 'permissions'
```

## DocumentoDetalhePage — Busca Unificada
Busca primeiro em mockDocumentos, depois em mockRelatorios.

## Versionamento
```javascript
{ numero: '2.1', data: '2025-01-10', descricao: 'Atualização', autor: 'Dr. Silva', arquivoUrl: '/path/to/v2.1.pdf' }
```
Modal: `max-h-[90vh] flex flex-col`, content `overflow-y-auto flex-1`.

## Gestão Contextual (Admin Only)
Menu engrenagem (só admins): Editar, Upload PDF, Nova versão, Excluir.

## DocumentCard Layout (v3.38.0)
- Card: `h-full flex flex-col`, content `flex-1`
- Título: `line-clamp-2 leading-tight` (até 2 linhas)
- Badges: `flex-wrap whitespace-nowrap`
- Footer: `mt-auto`, date wraps no mobile

## DocumentsContext — Single Source of Truth
```javascript
import { useDocuments } from '@/hooks';
const { documents, counts, isLoading } = useDocuments();
// documents.etica, documents.comites, etc.
```

## Integrações
- Centro de Gestão → aba Documentos (6 sub-seções)
- useComplianceMetrics → score Qmentum ponderado
- useDocuments → reviewAlerts (critical/warning/upcoming)
- Referência tipos: `src/types/documents.js`
