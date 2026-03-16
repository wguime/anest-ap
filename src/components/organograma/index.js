// Componentes do Organograma (Accordion-based)
export { default as OrgAccordion } from './OrgAccordion';
export { default as OrgAccordionItem } from './OrgAccordionItem';
export { default as OrgAdvisoryBadge } from './OrgAdvisoryBadge';
export { default as OrgControls } from './OrgControls';
export { OrgDetailModal } from './OrgDetailModal';
export { OrgEditModal } from './OrgEditModal';

// Cores e estilos
export {
  NODE_COLORS,
  getNodeClasses,
  getNodeHexColors,
  NODE_ICONS,
  getNodeIcon,
  NODE_TYPES,
} from './orgNodeColors';

// Re-export dados e helpers
export {
  ORGANOGRAMA_DATA,
  ORGANOGRAMA_DATA_DEFAULT,
  NODE_TYPES as DATA_NODE_TYPES,
  generateNodeId,
  findNodeById,
  findParentNode,
  deepCloneOrganograma,
  addChildNode,
  addAdvisoryNode,
  updateNode,
  removeNode,
  moveNode,
  getAllNodeIds,
  INITIAL_EXPANDED_IDS,
} from '../../data/organogramaData';
