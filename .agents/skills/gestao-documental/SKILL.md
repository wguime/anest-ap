---
name: gestao-documental
description: Gestão documental (Biblioteca, Relatórios, Gestão Documental do Centro de Gestão e o detalhe unificado; tipos e cores, versionamento, aprovação, arquivamento). Use ao criar ou editar documentos, tipos e cores, o fluxo de versão, aprovação e arquivamento, ou as páginas BibliotecaPage, RelatoriosPage, GestaoDocumentalPage e DocumentoDetalhePage.
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

## Tipos e cores
- Documentos: `TIPO_CONFIG` (rótulo + cor) e `SUBCATEGORIA_CONFIG` em `src/types/documents.js`. A
  taxonomia atual está no topo do mapa; `protocolo`/`politica`/`formulario`/`manual`/… no fim são
  legados mantidos por compatibilidade.
- Relatórios: `RELATORIO_TIPO_CONFIG` em `src/data/relatoriosConfig.js`.

## Navegação Unificada
```javascript
onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'biblioteca' });
// returnTo: 'biblioteca' | 'relatorios' | 'centro-gestao' | 'permissions'
```

## DocumentoDetalhePage — Busca Unificada
Pasta `src/pages/DocumentoDetalhePage/`: `hooks/useDocumentDetail.js` resolve o documento pelo `DocumentsContext` e pelo `supabaseDocumentService`.

## Versionamento
```javascript
{ numero: '2.1', data: '2025-01-10', descricao: 'Atualização', autor: 'Dr. Silva', arquivoUrl: '/path/to/v2.1.pdf' }
```
Modal: `max-h-[90vh] flex flex-col`, content `overflow-y-auto flex-1`.

## Gestão Contextual (Admin Only)
Botoeira de admin do detalhe (`DocumentApproval.jsx`): Editar, Nova versão, Histórico e Arquivar. Documento sai de circulação por arquivamento (`ArchiveDocumentModal`), não por exclusão — o arquivamento fecha o ciclo documental do Qmentum.

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
