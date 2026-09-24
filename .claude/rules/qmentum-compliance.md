---
paths:
  - "src/pages/management/documents/**"
  - "src/types/documents*"
  - "src/hooks/useDocuments*"
  - "src/hooks/useComplianceMetrics*"
description: Compliance Qmentum — ciclo documental (criação→aprovação→distribuição→revisão→arquivamento)
---

# Qmentum Compliance

## Categorias com Pesos
```javascript
QMENTUM_CATEGORIES = {   // chave = DOCUMENT_CATEGORIES.*; cada uma leva a sua ropArea
  etica: { weight: 1.2 },
  comites: { weight: 1.0 },
  auditorias: { weight: 1.5 },
  relatorios: { weight: 1.0 },
  biblioteca: { weight: 0.8 },
  financeiro: { weight: 1.1 },
  medicamentos: { weight: 1.0 },
  infeccoes: { weight: 1.0 },
  desastres: { weight: 1.0 }
}
```

## Compliance Flags
- `REVISION_OVERDUE` — Revisão atrasada
- `APPROVAL_PENDING` — Aguardando aprovação
- `MISSING_SIGNATURE` — Assinatura ausente
- `INCOMPLETE_WORKFLOW` — Workflow incompleto

## Workflow de Aprovação
`APPROVAL_WORKFLOW_TEMPLATE` define aprovadores padrão por tipo.
Status: `REVISAO_PENDENTE` com transições válidas definidas.

## Funções Chave
- `createApprovalEntry()` — Criar entrada de aprovação
- `getComplianceFlags()` — Avaliar status de compliance
- `reviewAlerts`: critical (vencido), warning (próximo), upcoming (futuro)

## useComplianceMetrics
```javascript
{
  qmentumScore,           // Score ponderado por QMENTUM_CATEGORIES
  ropAdherence,          // Aderência por área ROP (uma por categoria: 9)
  reviewComplianceRate,  // % revisões em dia
  approvalCycleTime,     // Tempo médio aprovação (dias)
  overdueByCategory,     // Docs vencidos por categoria
  documentCoverage,      // Existentes vs recomendados
  lgpdMetrics            // { totalSolicitacoes, pendentes, resolvidas, tempoMedioResposta (dias) }
}
```

## Referências
- Tipos e constantes: `src/types/documents.js`
- Hook compliance: `src/hooks/useComplianceMetrics.js`
- Hook documentos: `src/hooks/useDocuments.js`
