import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { PageHeader } from '../../components';

export default function AbreviaturasPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Abreviaturas Perigosas" onBack={() => onNavigate('auditorias')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        <SectionCard title="Sobre">
          <p className="text-sm text-muted-foreground">Esta secao apresenta as auditorias de identificacao e correcao de abreviaturas perigosas em prontuarios e prescricoes. A padronizacao da linguagem medica evita erros de interpretacao que podem comprometer a seguranca do paciente.</p>
        </SectionCard>
      </div>

    </div>
  );
}
