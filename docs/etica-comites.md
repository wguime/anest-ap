# Ética & Comitês — ANEST

## Sistema de Ética — 5 Categorias
| Categoria | Página | Collection Firestore |
|-----------|--------|---------------------|
| Dilemas Bioéticos | DilemasPage | etica_dilemas_documentos |
| Parecer Ético UTI | ParecerUtiPage | etica_parecer_uti_documentos |
| Diretrizes Institucionais | DiretrizesPage | etica_diretrizes_documentos |
| Emissão de Parecer | EmissaoParecerPage | etica_parecer_tecnico_documentos |
| Código de Ética | CodigoEticaPage | etica_codigo_documentos |

## Arquivos
- Config: `src/data/eticaConfig.js`
- Hook: `src/hooks/useEticaDocumentos.js` (loadDocumento, uploadDocumento, deleteDocumento)
- Upload: `src/components/etica/UploadDocumentoModal.jsx`
- Páginas: `src/pages/etica/*.jsx`

## Features
- Upload PDF (admin only) via UploadDocumentoModal
- Visualização inline via PDFViewer
- Metadata: título, data, autor, tamanho
- Delete com confirmação (admin only)

## 9 Tipos de Comitê
| Tipo | Cor | Ícone |
|------|-----|-------|
| regimento_interno | #2563eb | FileText |
| executivo | #059669 | Briefcase |
| financeiro | #059669 | DollarSign |
| gestao_pessoas | #7c3aed | Users |
| escalas | #f59e0b | Calendar |
| tecnologia | #2563eb | Cpu |
| qualidade | #2563eb | Shield |
| educacao | #dc2626 | BookOpen |
| etica_conduta | #7c3aed | Scale |

## Integração
- Centro de Gestão → aba Documentos → seção Ética
- DocumentsContext → SSOT para contagens e dados
