# Organograma — ANEST

## Arquitetura
Organograma interativo com accordion expansível, linhas conectoras, persistência Firebase.

## Arquivos
```
src/components/organograma/
├── OrgAccordion.jsx, OrgAccordionItem.jsx (recursivo)
├── OrgAdvisoryBadge.jsx, OrgControls.jsx
├── OrgDetailModal.jsx, OrgEditModal.jsx
└── orgNodeColors.js
src/data/organogramaData.js
src/hooks/useOrganograma.js (Firebase CRUD)
src/pages/OrganogramaPage.jsx
```

## NODE_TYPES
| Tipo | Cor Light | Ícone |
|------|-----------|-------|
| governance | #006837 | Building2 |
| executive | #1565C0 | UserCog |
| technical | #FF9800 | Stethoscope |
| admin | #7D8B69 | ClipboardList |
| committee | #4CAF50 | Users |
| operational | #9E9E9E | Briefcase |
| advisory | #9E9E9E (dashed) | MessageSquare |

## Node Structure
```javascript
{ id, cargo, tipo, linkType: 'solid'|'dotted', responsavel, descricao, contato, children: [], advisory: [] }
```

## Hook useOrganograma
- `data`, `loading`, `saving`, `error`
- `addChild(parentId, nodeData, userId)`
- `addAdvisory(parentId, nodeData, userId)`
- `update(nodeId, updates, userId)`, `remove(nodeId, userId)`
- `resetToDefault()`

## Firebase
Collection: `configuracoes` → document `organograma`

## Hierarquia Default (ANEST 2025)
Assembleia Geral (governance) → Coordenador Geral (executive) → [7 comitês + RT + Aux Admin]
Advisory: Comitê de Ética, Comitê Executivo de Gestão
