/**
 * Estrutura de dados do Organograma ANEST 2025
 * Baseado no PDF: Organograma2025.pdf
 *
 * HIERARQUIA CORRETA:
 * - Assembleia Geral (governance)
 *   - Coordenador Geral (executive)
 *     - [DOTTED] Comitê de ética e conduta (advisory)
 *     - [DOTTED] Comitê executivo de gestão (advisory)
 *     - Responsável técnico (technical) - sem filhos
 *     - Auxiliar Administrativo executivo (admin) - sem filhos (auxilia Coordenador)
 *     - 6 Comitês (committee) - filhos diretos do Coordenador
 *
 * Tipos de nós:
 * - governance: Assembleia Geral (#006837)
 * - executive: Coordenador Geral (#1565C0)
 * - technical: Responsável técnico (#FF9800)
 * - admin: Auxiliar Administrativo (#7D8B69)
 * - committee: Comitês (#4CAF50)
 * - operational: Áreas operacionais (#F5F5F5)
 * - advisory: Comitês consultivos (borda tracejada)
 *
 * linkType:
 * - solid: conexão normal
 * - dotted: conexão tracejada (advisory)
 */

export const ORGANOGRAMA_DATA = {
  id: 'assembleia-geral',
  cargo: 'Assembleia Geral',
  tipo: 'governance',
  linkType: 'solid',
  responsavel: null,
  descricao: 'Órgão máximo deliberativo da instituição, composto por todos os sócios.',
  contato: null,
  children: [
    {
      id: 'coordenador-geral',
      cargo: 'Coordenador Geral',
      tipo: 'executive',
      linkType: 'solid',
      responsavel: null,
      descricao: 'Responsável pela coordenação geral das atividades da clínica.',
      contato: null,
      // Comitês consultivos (advisory) - conexão DOTTED
      advisory: [
        {
          id: 'comite-etica-conduta',
          cargo: 'Comitê de ética e conduta',
          tipo: 'advisory',
          linkType: 'dotted',
          responsavel: null,
          descricao: 'Comitê consultivo para questões éticas e de conduta profissional.',
          contato: null,
        },
        {
          id: 'comite-executivo-gestao',
          cargo: 'Comitê executivo de gestão',
          tipo: 'advisory',
          linkType: 'dotted',
          responsavel: null,
          descricao: 'Comitê consultivo para decisões estratégicas de gestão.',
          contato: null,
        },
      ],
      children: [
        // Responsável Técnico - sem filhos
        {
          id: 'responsavel-tecnico',
          cargo: 'Responsável técnico',
          tipo: 'technical',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável técnico da instituição perante os órgãos reguladores.',
          contato: null,
        },
        // Auxiliar Administrativo - SEM FILHOS (auxilia o Coordenador)
        {
          id: 'aux-admin-executivo',
          cargo: 'Auxiliar Administrativo executivo',
          tipo: 'admin',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Suporte administrativo à coordenação executiva.',
          contato: null,
        },
        // Comitê de Gestão de Pessoas
        {
          id: 'comite-gestao-pessoas',
          cargo: 'Comitê de gestão de pessoas',
          tipo: 'committee',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável pela gestão de recursos humanos e desenvolvimento de pessoas.',
          contato: null,
          children: [
            {
              id: 'equipe-assistencial',
              cargo: 'Equipe assistencial Aux. Anestesia',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Equipe de auxiliares de anestesia.',
              contato: null,
            },
          ],
        },
        // Comitê Financeiro
        {
          id: 'comite-financeiro',
          cargo: 'Comitê Financeiro',
          tipo: 'committee',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável pela gestão financeira e orçamentária.',
          contato: null,
        },
        // Comitê de Qualidade
        {
          id: 'comite-qualidade',
          cargo: 'Comitê de Qualidade',
          tipo: 'committee',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável pela melhoria contínua e gestão da qualidade.',
          contato: null,
          children: [
            {
              id: 'consultorio',
              cargo: 'Consultório',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Atendimento em consultório.',
              contato: null,
              children: [
                {
                  id: 'ambulatorio-dor',
                  cargo: 'Ambulatório de dor',
                  tipo: 'operational',
                  linkType: 'solid',
                  responsavel: null,
                  descricao: 'Atendimento ambulatorial especializado em tratamento da dor.',
                  contato: null,
                },
                {
                  id: 'secretarias-recepcionistas',
                  cargo: 'Secretárias/Recepcionistas',
                  tipo: 'operational',
                  linkType: 'solid',
                  responsavel: null,
                  descricao: 'Atendimento e recepção de pacientes.',
                  contato: null,
                },
                {
                  id: 'aux-financeiro',
                  cargo: 'Aux. Financeiro',
                  tipo: 'operational',
                  linkType: 'solid',
                  responsavel: null,
                  descricao: 'Suporte às atividades financeiras.',
                  contato: null,
                },
                {
                  id: 'telefonista',
                  cargo: 'Telefonista',
                  tipo: 'operational',
                  linkType: 'solid',
                  responsavel: null,
                  descricao: 'Atendimento telefônico.',
                  contato: null,
                },
              ],
            },
            {
              id: 'assistencia-hospitalar',
              cargo: 'Assistência Hospitalar',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Assistência anestésica em ambiente hospitalar.',
              contato: null,
            },
            {
              id: 'anestesia-ambulatorial',
              cargo: 'Anestesia ambulatorial',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Procedimentos anestésicos ambulatoriais.',
              contato: null,
            },
            {
              id: 'comunicacao-interna-externa',
              cargo: 'Comunicação interna e externa',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Gestão da comunicação institucional.',
              contato: null,
            },
          ],
        },
        // Comitê Escalas
        {
          id: 'comite-escalas',
          cargo: 'Comitê Escalas',
          tipo: 'committee',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável pela organização das escalas de plantão.',
          contato: null,
        },
        // Comitê Educação Continuada e de Residência
        {
          id: 'comite-educacao',
          cargo: 'Comitê educação continuada e de residência',
          tipo: 'committee',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável pela formação médica e educação continuada.',
          contato: null,
          children: [
            {
              id: 'ed-continuada',
              cargo: 'Ed. Continuada',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Programas de educação continuada para a equipe.',
              contato: null,
            },
            {
              id: 'residencia-medica',
              cargo: 'Residência médica',
              tipo: 'operational',
              linkType: 'solid',
              responsavel: null,
              descricao: 'Programa de Residência Médica em Anestesiologia.',
              contato: null,
            },
          ],
        },
        // Comitê de Tecnologia e Materiais
        {
          id: 'comite-tecnologia',
          cargo: 'Comitê de Tecnologia e Materiais',
          tipo: 'committee',
          linkType: 'solid',
          responsavel: null,
          descricao: 'Responsável pela inovação tecnológica e gestão de materiais.',
          contato: null,
        },
      ],
    },
  ],
};

// Estrutura default para fallback
export const ORGANOGRAMA_DATA_DEFAULT = ORGANOGRAMA_DATA;

// Tipos de nós disponíveis
export const NODE_TYPES = [
  { value: 'governance', label: 'Governança' },
  { value: 'executive', label: 'Executivo' },
  { value: 'technical', label: 'Técnico' },
  { value: 'admin', label: 'Administrativo' },
  { value: 'committee', label: 'Comitê' },
  { value: 'operational', label: 'Operacional' },
  { value: 'advisory', label: 'Consultivo' },
];

// Helper para gerar ID único
export const generateNodeId = () => {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Helper para encontrar um nó por ID (recursivo)
export const findNodeById = (node, id) => {
  if (!node) return null;
  if (node.id === id) return node;

  // Procurar em advisory
  if (node.advisory) {
    for (const advNode of node.advisory) {
      const found = findNodeById(advNode, id);
      if (found) return found;
    }
  }

  // Procurar em children
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }

  return null;
};

// Helper para encontrar o pai de um nó
export const findParentNode = (root, targetId, parent = null) => {
  if (!root) return null;
  if (root.id === targetId) return parent;

  // Procurar em advisory
  if (root.advisory) {
    for (const advNode of root.advisory) {
      if (advNode.id === targetId) return root;
      const found = findParentNode(advNode, targetId, advNode);
      if (found) return found;
    }
  }

  // Procurar em children
  if (root.children) {
    for (const child of root.children) {
      if (child.id === targetId) return root;
      const found = findParentNode(child, targetId, child);
      if (found) return found;
    }
  }

  return null;
};

// Helper para clonar profundamente a estrutura (para edição imutável)
export const deepCloneOrganograma = (node) => {
  return JSON.parse(JSON.stringify(node));
};

// Helper para adicionar um nó filho
export const addChildNode = (root, parentId, newNode) => {
  const cloned = deepCloneOrganograma(root);
  const parent = findNodeById(cloned, parentId);

  if (parent) {
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push({ ...newNode, linkType: 'solid' });
  }

  return cloned;
};

// Helper para adicionar um nó advisory
export const addAdvisoryNode = (root, parentId, newNode) => {
  const cloned = deepCloneOrganograma(root);
  const parent = findNodeById(cloned, parentId);

  if (parent) {
    if (!parent.advisory) {
      parent.advisory = [];
    }
    parent.advisory.push({ ...newNode, tipo: 'advisory', linkType: 'dotted' });
  }

  return cloned;
};

// Helper para atualizar um nó
export const updateNode = (root, nodeId, updates) => {
  const cloned = deepCloneOrganograma(root);
  const node = findNodeById(cloned, nodeId);

  if (node) {
    Object.assign(node, updates);
  }

  return cloned;
};

// Helper para remover um nó
export const removeNode = (root, nodeId) => {
  const cloned = deepCloneOrganograma(root);

  const removeFromArray = (arr, id) => {
    const idx = arr.findIndex(n => n.id === id);
    if (idx !== -1) {
      arr.splice(idx, 1);
      return true;
    }
    return false;
  };

  const removeRecursive = (node) => {
    // Tentar remover de advisory
    if (node.advisory && removeFromArray(node.advisory, nodeId)) {
      return true;
    }

    // Tentar remover de children
    if (node.children && removeFromArray(node.children, nodeId)) {
      return true;
    }

    // Procurar recursivamente
    if (node.advisory) {
      for (const advNode of node.advisory) {
        if (removeRecursive(advNode)) return true;
      }
    }

    if (node.children) {
      for (const child of node.children) {
        if (removeRecursive(child)) return true;
      }
    }

    return false;
  };

  removeRecursive(cloned);
  return cloned;
};

// Helper para mover um nó para outro pai
export const moveNode = (root, nodeId, newParentId, asAdvisory = false) => {
  // Primeiro, encontrar e remover o nó
  const nodeToMove = findNodeById(root, nodeId);
  if (!nodeToMove) return root;

  // Não permitir mover para si mesmo ou para um descendente
  if (newParentId === nodeId) return root;
  if (findNodeById(nodeToMove, newParentId)) return root;

  // Clonar o nó a ser movido
  const clonedNode = deepCloneOrganograma(nodeToMove);

  // Remover da posição atual
  let cloned = removeNode(root, nodeId);

  // Adicionar na nova posição
  if (asAdvisory) {
    cloned = addAdvisoryNode(cloned, newParentId, clonedNode);
  } else {
    cloned = addChildNode(cloned, newParentId, clonedNode);
  }

  return cloned;
};

// Helper para obter todos os IDs de nós (para expandir tudo)
export const getAllNodeIds = (node, ids = []) => {
  if (!node) return ids;

  ids.push(node.id);

  if (node.advisory) {
    node.advisory.forEach(adv => getAllNodeIds(adv, ids));
  }

  if (node.children) {
    node.children.forEach(child => getAllNodeIds(child, ids));
  }

  return ids;
};

// IDs para estado inicial expandido
export const INITIAL_EXPANDED_IDS = [
  'assembleia-geral',
  'coordenador-geral',
];
