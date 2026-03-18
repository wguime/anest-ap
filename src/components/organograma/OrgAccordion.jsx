/**
 * OrgAccordion - Container principal do organograma
 * Usa o Accordion do DS com type="multiple" para multiplos itens abertos
 */

import { useState, useCallback, useMemo } from 'react';
import { Accordion } from '@/design-system';
import OrgAccordionItem from './OrgAccordionItem';
import OrgControls from './OrgControls';
import { getAllNodeIds, INITIAL_EXPANDED_IDS } from '@/data/organogramaData';

/**
 * @param {object} props
 * @param {object} props.data - Dados do organograma (ORGANOGRAMA_DATA)
 * @param {function} props.onNodeClick - Callback ao clicar em um no (abre detalhes)
 * @param {boolean} props.isEditMode - Se esta em modo de edicao
 * @param {function} props.onEdit - Callback para editar um no
 * @param {function} props.onDelete - Callback para deletar um no
 * @param {function} props.onAddChild - Callback para adicionar filho
 * @param {function} props.onAddAdvisory - Callback para adicionar advisory
 */
export default function OrgAccordion({
  data,
  onNodeClick,
  isEditMode = false,
  onEdit,
  onDelete,
  onAddChild,
  onAddAdvisory,
}) {
  // Estado de expansao controlado
  const [expandedNodes, setExpandedNodes] = useState(() => INITIAL_EXPANDED_IDS);

  // Todos os IDs para expand all
  const allNodeIds = useMemo(() => getAllNodeIds(data), [data]);

  // Handlers para controles globais
  const handleExpandAll = useCallback(() => {
    setExpandedNodes(allNodeIds);
  }, [allNodeIds]);

  const handleCollapseAll = useCallback(() => {
    // Manter apenas o no raiz aberto
    setExpandedNodes(['assembleia-geral']);
  }, []);

  // Handler para mudanca de valor do accordion
  const handleValueChange = useCallback((value) => {
    setExpandedNodes(value);
  }, []);

  if (!data) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Carregando organograma...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controles globais */}
      <OrgControls
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        isEditMode={isEditMode}
      />

      {/* Accordion principal */}
      <Accordion
        type="multiple"
        value={expandedNodes}
        onValueChange={handleValueChange}
        className="space-y-1"
      >
        <OrgAccordionItem
          node={data}
          level={0}
          onNodeClick={onNodeClick}
          isEditMode={isEditMode}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onAddAdvisory={onAddAdvisory}
        />
      </Accordion>
    </div>
  );
}
