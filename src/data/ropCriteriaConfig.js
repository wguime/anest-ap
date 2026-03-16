/**
 * ROP Criteria Config — Critérios Qmentum + mapeamento de itens de auditoria por ROP
 *
 * Cada ROP tem:
 * - requirementSummary: extraído do explanation das questions em rops-data.js
 * - criteria[]: 3-5 testes de conformidade Qmentum
 * - auditItemMapping[]: quais itens de qual template de auditoria validam este ROP
 */

import { AUDIT_TEMPLATES } from '@/data/auditoriaTemplatesConfig'

// ============================================================================
// ROP_CRITERIA — 32 ROPs
// ============================================================================

export const ROP_CRITERIA = {
  // ==================== AREA 1 - CULTURA DE SEGURANÇA ====================
  'rop-1-1': {
    requirementSummary: 'A alta administração assume responsabilidade pela qualidade, define indicadores, acompanha metas e aloca recursos.',
    criteria: [
      { id: 'c1', text: 'Política de qualidade formalizada, divulgada e acessível a todos os colaboradores', category: 'Governança' },
      { id: 'c2', text: 'Indicadores de qualidade monitorados com periodicidade definida', category: 'Monitoramento' },
      { id: 'c3', text: 'Planos de ação para não conformidades com prazos e responsáveis', category: 'Melhoria' },
      { id: 'c4', text: 'Reuniões de análise crítica realizadas e documentadas', category: 'Governança' },
    ],
    auditItemMapping: [
      { auditType: 'politica_qualidade', itemIds: ['item-01', 'item-02', 'item-03', 'item-04', 'item-05', 'item-06'] },
    ],
  },
  'rop-1-2': {
    requirementSummary: 'Sistema que incentiva notificação, análise e aprendizado com incidentes, com foco na melhoria.',
    criteria: [
      { id: 'c1', text: 'Sistema de notificação de incidentes ativo e acessível', category: 'Notificação' },
      { id: 'c2', text: 'Ambiente favorece relato de incidentes sem punição', category: 'Cultura' },
      { id: 'c3', text: 'Incidentes analisados com identificação de causas-raiz', category: 'Análise' },
      { id: 'c4', text: 'Ações corretivas implementadas e eficácia verificada', category: 'Melhoria' },
    ],
    auditItemMapping: [
      { auditType: 'seguranca_paciente', itemIds: ['item-08'] },
    ],
  },
  'rop-1-3': {
    requirementSummary: 'A alta gestão recebe, discute e acompanha relatórios periódicos com achados e melhorias.',
    criteria: [
      { id: 'c1', text: 'Relatórios trimestrais de segurança apresentados ao corpo diretivo', category: 'Governança' },
      { id: 'c2', text: 'Achados analisados com recomendações de ações', category: 'Análise' },
      { id: 'c3', text: 'Acompanhamento das ações recomendadas nos relatórios anteriores', category: 'Seguimento' },
    ],
    auditItemMapping: [
      { auditType: 'politica_disclosure', itemIds: ['item-06'] },
    ],
  },
  'rop-1-4': {
    requirementSummary: 'Processo documentado de disclosure com comunicação transparente e apoio as pessoas envolvidas.',
    criteria: [
      { id: 'c1', text: 'Política de disclosure formalizada e aprovada', category: 'Documentação' },
      { id: 'c2', text: 'Equipe treinada em comunicação de eventos adversos', category: 'Capacitação' },
      { id: 'c3', text: 'Comunicações ao paciente/família documentadas', category: 'Registro' },
      { id: 'c4', text: 'Suporte psicológico oferecido após revelação', category: 'Acolhimento' },
    ],
    auditItemMapping: [],
  },

  // ==================== AREA 2 - COMUNICAÇÃO ====================
  'rop-2-1': {
    requirementSummary: 'Uso de pelo menos dois identificadores (ex.: nome completo e data de nascimento) antes de qualquer cuidado.',
    criteria: [
      { id: 'c1', text: 'Pulseira com nome completo e segundo identificador em uso', category: 'Identificação' },
      { id: 'c2', text: 'Conferência ativa da identidade antes de procedimentos e medicações', category: 'Verificação' },
      { id: 'c3', text: 'Política de identificação formalizada e divulgada', category: 'Documentação' },
    ],
    auditItemMapping: [
      { auditType: 'seguranca_paciente', itemIds: ['item-01'] },
    ],
  },
  'rop-2-2': {
    requirementSummary: 'Padroniza o não uso de abreviações, símbolos e designações de dose que causam confusão.',
    criteria: [
      { id: 'c1', text: 'Lista de abreviações proibidas divulgada e acessível', category: 'Documentação' },
      { id: 'c2', text: 'Prescrições e evoluções livres de abreviações perigosas', category: 'Prescrição' },
      { id: 'c3', text: 'Rótulos de farmácia e formulários pré-impressos conformes', category: 'Farmácia' },
      { id: 'c4', text: 'Doses escritas por extenso quando necessário (0,5 mg em vez de .5 mg)', category: 'Prescrição' },
    ],
    auditItemMapping: [
      { auditType: 'abreviaturas', itemIds: ['item-01', 'item-02', 'item-03', 'item-04', 'item-05', 'item-06'] },
    ],
  },
  'rop-2-3': {
    requirementSummary: 'Organização prioriza conciliação medicamentosa com recursos e indicadores institucionais.',
    criteria: [
      { id: 'c1', text: 'Conciliação medicamentosa definida como prioridade estratégica', category: 'Governança' },
      { id: 'c2', text: 'Recursos alocados para implementação do processo', category: 'Recursos' },
      { id: 'c3', text: 'Indicadores de conciliação monitorados', category: 'Monitoramento' },
    ],
    auditItemMapping: [],
  },
  'rop-2-4': {
    requirementSummary: 'Conciliação sistemática na admissão, transferência e alta em pacientes internados.',
    criteria: [
      { id: 'c1', text: 'Conciliação realizada na admissão com lista completa de medicamentos', category: 'Admissão' },
      { id: 'c2', text: 'Conciliação realizada nas transferências internas', category: 'Transferência' },
      { id: 'c3', text: 'Conciliação realizada na alta com orientações ao paciente', category: 'Alta' },
    ],
    auditItemMapping: [],
  },
  'rop-2-5': {
    requirementSummary: 'Revisão do histórico medicamentoso e reconciliação em consultas ambulatoriais.',
    criteria: [
      { id: 'c1', text: 'Histórico medicamentoso revisado em cada consulta ambulatorial', category: 'Verificação' },
      { id: 'c2', text: 'Discrepâncias identificadas e resolvidas', category: 'Reconciliação' },
      { id: 'c3', text: 'Registro da conciliação no prontuário ambulatorial', category: 'Registro' },
    ],
    auditItemMapping: [],
  },
  'rop-2-6': {
    requirementSummary: 'Processos ágeis para conciliação na emergência, considerando risco e tempo disponível.',
    criteria: [
      { id: 'c1', text: 'Processo de conciliação adaptado ao contexto de emergência', category: 'Processo' },
      { id: 'c2', text: 'Priorização baseada em risco do paciente', category: 'Priorização' },
      { id: 'c3', text: 'Registro mínimo de medicamentos em uso antes de novas prescrições', category: 'Registro' },
    ],
    auditItemMapping: [],
  },
  'rop-2-7': {
    requirementSummary: 'Aplicação do checklist (antes da indução, antes da incisão e antes de sair da sala).',
    criteria: [
      { id: 'c1', text: 'Checklist de cirurgia segura aplicado nas 3 fases (sign-in, time-out, sign-out)', category: 'Checklist' },
      { id: 'c2', text: 'Demarcação do sitio cirúrgico realizada quando aplicável', category: 'Demarcação' },
      { id: 'c3', text: 'Equipe participa ativamente do time-out', category: 'Participação' },
    ],
    auditItemMapping: [],
  },
  'rop-2-8': {
    requirementSummary: 'Padroniza handover com informações críticas, plano e responsabilidades (ex.: SBAR).',
    criteria: [
      { id: 'c1', text: 'Ferramenta padronizada de handover em uso (SBAR ou equivalente)', category: 'Ferramenta' },
      { id: 'c2', text: 'Informações críticas transferidas em passagens de plantão', category: 'Comunicação' },
      { id: 'c3', text: 'Registro de handover documentado', category: 'Registro' },
    ],
    auditItemMapping: [],
  },
  'rop-2-9': {
    requirementSummary: 'Resultados críticos são comunicados rapidamente ao responsável com rastreabilidade.',
    criteria: [
      { id: 'c1', text: 'Definição de resultados críticos com lista padronizada', category: 'Definição' },
      { id: 'c2', text: 'Comunicação ao responsável em tempo hábil', category: 'Comunicação' },
      { id: 'c3', text: 'Rastreabilidade da comunicação (quem, quando, para quem)', category: 'Registro' },
    ],
    auditItemMapping: [],
  },

  // ==================== AREA 3 - USO DE MEDICAMENTOS ====================
  'rop-3-1': {
    requirementSummary: 'Identificação, dupla checagem e barreiras para reduzir erros com medicamentos de alto risco.',
    criteria: [
      { id: 'c1', text: 'Medicamentos de alta vigilância identificados e sinalizados', category: 'Identificação' },
      { id: 'c2', text: 'Dupla checagem realizada antes da administração', category: 'Segurança' },
      { id: 'c3', text: 'Armazenamento segregado de medicamentos de alto risco', category: 'Armazenamento' },
    ],
    auditItemMapping: [],
  },
  'rop-3-2': {
    requirementSummary: 'Restrição de estoque, rotulagem clara e políticas de diluição/dispensação de eletrólitos concentrados.',
    criteria: [
      { id: 'c1', text: 'Eletrólitos concentrados não estocados em áreas assistenciais', category: 'Restrição' },
      { id: 'c2', text: 'Rotulagem clara e padronizada dos eletrólitos', category: 'Rotulagem' },
      { id: 'c3', text: 'Política de diluição e dispensação formalizada', category: 'Política' },
    ],
    auditItemMapping: [
      { auditType: 'uso_medicamentos', itemIds: ['item-07'] },
    ],
  },
  'rop-3-3': {
    requirementSummary: 'Estratégias para diferenciar, armazenar e prescrever medicamentos LASA a fim de evitar confusão.',
    criteria: [
      { id: 'c1', text: 'Medicamentos LASA identificados e sinalizados com destaque', category: 'Identificação' },
      { id: 'c2', text: 'Armazenamento separado de medicamentos com nomes/aparência semelhantes', category: 'Armazenamento' },
      { id: 'c3', text: 'Estratégias de prescrição para diferenciar (Tall Man Lettering)', category: 'Prescrição' },
    ],
    auditItemMapping: [
      { auditType: 'uso_medicamentos', itemIds: ['item-08'] },
    ],
  },
  'rop-3-4': {
    requirementSummary: 'Controle de acesso, contagem, monitorização e educação para uso seguro de opioides e controlados.',
    criteria: [
      { id: 'c1', text: 'Controle de acesso e contagem de opioides e controlados', category: 'Controle' },
      { id: 'c2', text: 'Monitorização do paciente durante uso de opioides', category: 'Monitorização' },
      { id: 'c3', text: 'Educação da equipe sobre uso seguro de opioides', category: 'Capacitação' },
    ],
    auditItemMapping: [],
  },
  'rop-3-5': {
    requirementSummary: 'Biblioteca de doses, padronização de equipamentos e treinamento para bombas de infusão.',
    criteria: [
      { id: 'c1', text: 'Bombas de infusão com biblioteca de medicamentos (smart pump) ativa', category: 'Tecnologia' },
      { id: 'c2', text: 'Limites de dose configurados e atualizados', category: 'Configuração' },
      { id: 'c3', text: 'Equipe treinada no uso das bombas de infusão', category: 'Capacitação' },
    ],
    auditItemMapping: [
      { auditType: 'uso_medicamentos', itemIds: ['item-09'] },
    ],
  },

  // ==================== AREA 4 - VIDA PROFISSIONAL ====================
  'rop-4-1': {
    requirementSummary: 'Treinamentos, validação de competências e registros atualizados.',
    criteria: [
      { id: 'c1', text: 'Carga horária mínima de treinamento cumprida por profissional', category: 'Capacitação' },
      { id: 'c2', text: 'Plano de desenvolvimento individual documentado', category: 'Desenvolvimento' },
      { id: 'c3', text: 'Competências validadas e registros atualizados', category: 'Registro' },
    ],
    auditItemMapping: [
      { auditType: 'vida_profissional', itemIds: ['item-05', 'item-06'] },
    ],
  },
  'rop-4-2': {
    requirementSummary: 'Políticas de escalas, pausas, limites de horas e mitigação da fadiga.',
    criteria: [
      { id: 'c1', text: 'Escalas de trabalho conforme legislação e limites de carga horária', category: 'Escala' },
      { id: 'c2', text: 'Pausas e descanso entre plantões respeitados', category: 'Descanso' },
      { id: 'c3', text: 'Política de mitigação da fadiga implementada', category: 'Política' },
    ],
    auditItemMapping: [
      { auditType: 'vida_profissional', itemIds: ['item-08'] },
    ],
  },
  'rop-4-3': {
    requirementSummary: 'Protocolos de prevenção, relatório e resposta a violência e assédio no local de trabalho.',
    criteria: [
      { id: 'c1', text: 'Canal de denúncias anônimo acessível para relatos de assédio e violência', category: 'Canal' },
      { id: 'c2', text: 'Protocolo de prevenção e resposta a violência formalizado', category: 'Protocolo' },
      { id: 'c3', text: 'Treinamento da equipe sobre prevenção de violência', category: 'Capacitação' },
    ],
    auditItemMapping: [
      { auditType: 'vida_profissional', itemIds: ['item-09'] },
    ],
  },
  'rop-4-4': {
    requirementSummary: 'Ambiente que favorece relato sem punição e aprendizagem organizacional.',
    criteria: [
      { id: 'c1', text: 'Cultura justa promovida com política de relato sem punição', category: 'Cultura' },
      { id: 'c2', text: 'Comunicação de situações de risco incentivada', category: 'Comunicação' },
      { id: 'c3', text: 'Aprendizagem organizacional a partir dos relatos', category: 'Aprendizagem' },
    ],
    auditItemMapping: [],
  },
  'rop-4-5': {
    requirementSummary: 'Suporte após eventos adversos, saúde mental e recursos de bem-estar para a equipe.',
    criteria: [
      { id: 'c1', text: 'Avaliação periódica de burnout realizada', category: 'Avaliação' },
      { id: 'c2', text: 'Programa de apoio psicológico disponível', category: 'Apoio' },
      { id: 'c3', text: 'Suporte ao segundo vítima após eventos adversos', category: 'Suporte' },
    ],
    auditItemMapping: [
      { auditType: 'vida_profissional', itemIds: ['item-01', 'item-02'] },
    ],
  },

  // ==================== AREA 5 - PREVENÇÃO DE INFECÇÕES ====================
  'rop-5-1': {
    requirementSummary: 'Cumprimento dos 5 momentos de higiene das mãos, auditorias de adesão e feedback.',
    criteria: [
      { id: 'c1', text: 'Programa de higiene das mãos implementado com adesão monitorada', category: 'Monitoramento' },
      { id: 'c2', text: 'Insumos (álcool gel, sabonete) disponíveis em todos os pontos de assistência', category: 'Infraestrutura' },
      { id: 'c3', text: 'Treinamento periódico da equipe sobre os 5 momentos', category: 'Capacitação' },
      { id: 'c4', text: 'Taxa de adesão medida e resultados divulgados a equipe', category: 'Feedback' },
    ],
    auditItemMapping: [
      { auditType: 'higiene_maos', itemIds: ['item-01', 'item-02', 'item-03', 'item-04', 'item-05', 'item-06', 'item-07', 'item-08', 'item-09'] },
    ],
  },
  'rop-5-2': {
    requirementSummary: 'Fluxos, rastreabilidade, validação e monitorização do reprocessamento de produtos para saúde.',
    criteria: [
      { id: 'c1', text: 'Processamento de materiais conforme normas vigentes', category: 'Processo' },
      { id: 'c2', text: 'Rastreabilidade do reprocessamento implementada', category: 'Rastreabilidade' },
      { id: 'c3', text: 'Validação de ciclos de esterilização documentada', category: 'Validação' },
    ],
    auditItemMapping: [
      { auditType: 'controle_infeccao', itemIds: ['item-05'] },
    ],
  },
  'rop-5-3': {
    requirementSummary: 'Rotinas, produtos adequados e verificação da eficácia da limpeza de superfícies e equipamentos.',
    criteria: [
      { id: 'c1', text: 'Protocolos de limpeza ambiental seguidos conforme cronograma', category: 'Protocolo' },
      { id: 'c2', text: 'Produtos de limpeza adequados e padronizados', category: 'Insumos' },
      { id: 'c3', text: 'Verificação da eficácia da limpeza realizada', category: 'Verificação' },
    ],
    auditItemMapping: [
      { auditType: 'controle_infeccao', itemIds: ['item-07'] },
    ],
  },
  'rop-5-4': {
    requirementSummary: 'Bundles para cateteres, ventilação, urinário com adesão monitorada.',
    criteria: [
      { id: 'c1', text: 'Bundle de prevenção de infecção de cateter venoso aplicado', category: 'Bundle' },
      { id: 'c2', text: 'Revisão diária da necessidade de dispositivos invasivos', category: 'Revisão' },
      { id: 'c3', text: 'Adesão aos bundles monitorada e divulgada', category: 'Monitoramento' },
    ],
    auditItemMapping: [
      { auditType: 'controle_infeccao', itemIds: ['item-04'] },
    ],
  },
  'rop-5-5': {
    requirementSummary: 'Critérios de isolamento, EPIs e sinalização para reduzir transmissão de patógenos.',
    criteria: [
      { id: 'c1', text: 'Precauções de isolamento implementadas com sinalização adequada', category: 'Isolamento' },
      { id: 'c2', text: 'EPIs específicos disponíveis e utilizados corretamente', category: 'EPIs' },
      { id: 'c3', text: 'Critérios de isolamento seguidos conforme perfil do patógeno', category: 'Critérios' },
    ],
    auditItemMapping: [
      { auditType: 'controle_infeccao', itemIds: ['item-02'] },
    ],
  },

  // ==================== AREA 6 - AVALIAÇÃO DE RISCOS ====================
  'rop-6-1': {
    requirementSummary: 'Estratificação de risco, medidas ambientais e educação ao paciente para prevenção de quedas.',
    criteria: [
      { id: 'c1', text: 'Avaliação de risco de queda realizada com instrumento validado', category: 'Avaliação' },
      { id: 'c2', text: 'Medidas preventivas implementadas conforme escore de risco', category: 'Prevenção' },
      { id: 'c3', text: 'Sinalização e educação do paciente e acompanhante', category: 'Educação' },
    ],
    auditItemMapping: [
      { auditType: 'seguranca_paciente', itemIds: ['item-06'] },
    ],
  },
  'rop-6-2': {
    requirementSummary: 'Avaliação de risco de lesão por pressão, mudança de decúbito e proteção de proeminências.',
    criteria: [
      { id: 'c1', text: 'Avaliação de risco com escala Braden realizada na admissão', category: 'Avaliação' },
      { id: 'c2', text: 'Mudanca de decúbito conforme protocolo', category: 'Prevenção' },
      { id: 'c3', text: 'Superfícies de redistribuição de pressão utilizadas quando indicado', category: 'Recursos' },
    ],
    auditItemMapping: [
      { auditType: 'seguranca_paciente', itemIds: ['item-07'] },
    ],
  },
  'rop-6-3': {
    requirementSummary: 'Estratificação, profilaxia adequada e reavaliação contínua do risco de TEV.',
    criteria: [
      { id: 'c1', text: 'Avaliação de risco de TEV realizada em pacientes cirúrgicos e clínicos', category: 'Avaliação' },
      { id: 'c2', text: 'Profilaxia farmacológica e/ou mecânica implementada conforme risco', category: 'Profilaxia' },
      { id: 'c3', text: 'Reavaliação do risco realizada periodicamente', category: 'Reavaliação' },
    ],
    auditItemMapping: [
      { auditType: 'seguranca_paciente', itemIds: ['item-09'] },
    ],
  },
  'rop-6-4': {
    requirementSummary: 'Rastreamento, ambiente seguro, plano e encaminhamentos para risco de suicídio/autoagressão.',
    criteria: [
      { id: 'c1', text: 'Rastreamento de risco de suicídio realizado em populações vulneráveis', category: 'Rastreamento' },
      { id: 'c2', text: 'Ambiente seguro com remoção de riscos ambientais', category: 'Ambiente' },
      { id: 'c3', text: 'Plano de cuidado e encaminhamento para acompanhamento especializado', category: 'Plano' },
    ],
    auditItemMapping: [],
  },
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Retorna critérios do ROP ou null se não encontrado
 */
export function getRopCriteria(ropId) {
  return ROP_CRITERIA[ropId] || null
}

/**
 * Retorna lista de audit items mapeados para este ROP
 * Formato: [{ auditType, itemIds, items[] }]
 * onde items[] contém os dados do template (label, description, etc.)
 */
export function getAuditItemsForRop(ropId) {
  const config = ROP_CRITERIA[ropId]
  if (!config || !config.auditItemMapping || config.auditItemMapping.length === 0) return []

  return config.auditItemMapping.map(({ auditType, itemIds }) => {
    const template = AUDIT_TEMPLATES[auditType]
    if (!template) return { auditType, itemIds, items: [] }

    const items = itemIds
      .map((itemId) => template.items.find((ti) => ti.id === itemId))
      .filter(Boolean)

    return { auditType, itemIds, items }
  })
}

// ============================================================================
// computeStatusSuggestion — Algoritmo de sugestão de status
// ============================================================================

/**
 * Calcula sugestão de status baseada em auditorias vinculadas.
 *
 * TIER 1: Itens de auditoria mapeados para ESTE ROP (alta confiança)
 *   → Busca respostas C/NC/NA dos itens específicos na última execucao concluída
 *   → Score = C / (C + NC) * 100 (NA excluído)
 *   → 100% = conforme, 50-99% = parcialmente_conforme, <50% = nao_conforme
 *
 * TIER 2: Fallback - media de scores da area (confiança media)
 *   → Usa scoreConformidade geral das auditorias concluídas
 *   → Mesmos thresholds
 *
 * TIER 3: Sem dados → suggestedStatus: null
 *
 * @param {string} ropId
 * @param {Array} auditoriasVinculadas - array de { tipo, config, concluídas, última }
 * @returns {{ suggestedStatus: string|null, confidence: string, score: number|null, details: string, ncItems: Array }}
 */
export function computeStatusSuggestion(ropId, auditoriasVinculadas) {
  const config = ROP_CRITERIA[ropId]

  // TIER 1: Itens mapeados especificamente para este ROP
  if (config && config.auditItemMapping && config.auditItemMapping.length > 0) {
    let totalC = 0
    let totalNC = 0
    const ncItems = []
    let hasData = false

    for (const mapping of config.auditItemMapping) {
      const auditData = auditoriasVinculadas.find((a) => a.tipo === mapping.auditType)
      if (!auditData || !auditData.ultima) continue

      const respostas = auditData.ultima.respostas || {}

      for (const itemId of mapping.itemIds) {
        const resposta = respostas[itemId]
        if (resposta === 'C') {
          totalC++
          hasData = true
        } else if (resposta === 'NC') {
          totalNC++
          hasData = true
          // Get item label from template for display
          const template = AUDIT_TEMPLATES[mapping.auditType]
          const itemInfo = template?.items?.find((i) => i.id === itemId)
          ncItems.push({
            auditType: mapping.auditType,
            itemId,
            label: itemInfo?.label || itemId,
          })
        }
        // NA is excluded from calculation
      }
    }

    if (hasData) {
      const total = totalC + totalNC
      const score = total > 0 ? Math.round((totalC / total) * 100) : 100
      const suggestedStatus = score >= 100
        ? 'conforme'
        : score >= 50
          ? 'parcialmente_conforme'
          : 'nao_conforme'

      return {
        suggestedStatus,
        confidence: 'alta',
        score,
        details: `Baseado em ${total} item(ns) de auditoria mapeado(s) para este ROP`,
        ncItems,
      }
    }
  }

  // TIER 2: Fallback - media de scores de auditorias concluídas da area
  const concluidasComScore = auditoriasVinculadas
    .filter((a) => a.ultima && a.ultima.scoreConformidade != null)
    .map((a) => a.ultima.scoreConformidade)

  if (concluidasComScore.length > 0) {
    const avgScore = Math.round(
      concluidasComScore.reduce((sum, s) => sum + s, 0) / concluidasComScore.length
    )
    const suggestedStatus = avgScore >= 100
      ? 'conforme'
      : avgScore >= 50
        ? 'parcialmente_conforme'
        : 'nao_conforme'

    return {
      suggestedStatus,
      confidence: 'media',
      score: avgScore,
      details: `Baseado na media de ${concluidasComScore.length} auditoria(s) da area`,
      ncItems: [],
    }
  }

  // TIER 3: Sem dados
  return {
    suggestedStatus: null,
    confidence: 'nenhuma',
    score: null,
    details: 'Nenhuma auditoria concluída disponível',
    ncItems: [],
  }
}
