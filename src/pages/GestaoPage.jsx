import {
  ComunicadosCard,
  WidgetCard,
} from '@/design-system';
import {
  DollarSign,
  Calendar,
  Shield,
  Users,
} from 'lucide-react';
import { useCardPermissions } from '../hooks/useCardPermissions';

// Dados para o card de Gestão de Incidentes
const incidentesItems = [
  'Notificar eventos adversos',
  'Registrar near miss',
];

// Dados para o card de Biblioteca de Documentos
const bibliotecaItems = [
  'Protocolos clínicos',
  'POPs e manuais',
];

export default function GestaoPage({ onNavigate }) {
  const { canAccessCard } = useCardPermissions();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-4 sm:px-5 lg:px-6 xl:px-8">
        {/* Card: Gestão de Incidentes (mesmo estilo do Comunicados) */}
        {canAccessCard('incidentes') && (
          <div className="mb-3">
            <ComunicadosCard
              label="SEGURANÇA"
              title="Gestão de Incidentes"
              badgeText="Relatar"
              items={incidentesItems}
              onViewAll={() => onNavigate('incidentes')}
            />
          </div>
        )}

        {/* Card: Biblioteca de Documentos (mesmo estilo do Comunicados) */}
        {canAccessCard('biblioteca') && (
          <div className="mb-4">
            <ComunicadosCard
              label="DOCUMENTOS"
              title="Biblioteca de Documentos"
              badgeText="Acessar"
              items={bibliotecaItems}
              onViewAll={() => onNavigate('biblioteca')}
            />
          </div>
        )}

        {/* Grid de Widgets 2 colunas - todos mesma dimensão */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {/* Qualidade - logo abaixo da Biblioteca */}
          {canAccessCard('qualidade') && (
            <WidgetCard
              icon={<Shield className="w-6 h-6" />}
              title="Qualidade"
              subtitle="Gestão da qualidade"
              variant="interactive"
              onClick={() => onNavigate('qualidade')}
            />
          )}
          {canAccessCard('faturamento') && (
            <WidgetCard
              icon={<DollarSign className="w-6 h-6" />}
              title="Faturamento"
              subtitle="Gestão e faturamento"
              variant="interactive"
              onClick={() => onNavigate('faturamento')}
            />
          )}
          {canAccessCard('escalas') && (
            <WidgetCard
              icon={<Calendar className="w-6 h-6" />}
              title="Escalas"
              subtitle="Gestão de escalas"
              variant="interactive"
              onClick={() => onNavigate('escalas')}
            />
          )}
          {canAccessCard('reunioes') && (
            <WidgetCard
              icon={<Users className="w-6 h-6" />}
              title="Reuniões"
              subtitle="Gestão de reuniões"
              variant="interactive"
              onClick={() => onNavigate('reunioes')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
