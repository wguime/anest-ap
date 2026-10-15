// Exports centralizados dos componentes
export { default as PageHeader } from './PageHeader';
export { default as PageShell } from './PageShell';
export { default as SearchInput } from './SearchInput';
export { default as DocumentoCard } from './DocumentoCard';
export { default as TipoTabs } from './TipoTabs';

// Componentes de Residencia — direto dos arquivos, NÃO do barrel './residencia':
// o barrel traz o ResidenciaChat (dompurify + react-markdown), e como quase todo
// o app importa deste index (PageHeader), o chat entrava no pacote de TODA
// abertura sem ninguém usá-lo (15/10/2026).
export { EditEstagiosModal } from './residencia/EditEstagiosModal';
export { EditPlantaoModal } from './residencia/EditPlantaoModal';
