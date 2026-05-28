import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '../../components';

export default function AuditoriasOperacionaisPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Auditorias Operacionais" onBack={() => onNavigate('auditorias')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao consolida as auditorias operacionais relacionadas aos processos assistenciais. Inclui verificacoes de conformidade com protocolos clinicos, checagem de processos criticos e monitoramento da qualidade da assistencia prestada.</p>
        </SectionCard>
      </div>

    </div>
  );
}
