import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { useDocumentsByCategory } from '@/hooks/useDocumentsByCategory';
import { DocumentoCard, PageHeader } from '@/components';

export default function PlanoApoioPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');
  const { allDocuments } = useDocumentsByCategory('desastres');
  const documentos = allDocuments
    .filter(d => d.tipo === 'apoio_psicologico' && d.status !== 'arquivado')
    .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));

  const handleDocumentoClick = (doc) => {
    onNavigate('documento-detalhe', { documentoId: doc.id, returnTo: 'planoApoio' });
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Apoio Psicologico" onBack={() => onNavigate('desastres')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Arquivos" subtitle={`${documentos.length} documento${documentos.length !== 1 ? 's' : ''}`}>
          {documentos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {documentos.map((doc) => (
                <DocumentoCard
                  key={doc.id}
                  documento={doc}
                  onClick={() => handleDocumentoClick(doc)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum documento disponivel.
            </p>
          )}
        </SectionCard>
      </div>

    </div>
  );
}
