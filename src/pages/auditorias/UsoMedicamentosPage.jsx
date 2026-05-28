import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '../../components';

export default function UsoMedicamentosPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Uso de Medicamentos" onBack={() => onNavigate('auditorias')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao apresenta as auditorias relacionadas ao uso seguro de medicamentos, incluindo verificacao de prescricoes, armazenamento, dispensacao e administracao. Monitora a conformidade com os protocolos de seguranca medicamentosa.</p>
        </SectionCard>
      </div>

    </div>
  );
}
