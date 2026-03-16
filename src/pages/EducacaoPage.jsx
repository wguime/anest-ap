import {
  ComunicadosCard,
  WidgetCard,
} from '@/design-system';
import {
  Target,
  GraduationCap,
} from 'lucide-react';
import { useCardPermissions } from '../hooks/useCardPermissions';

// Dados para o card de Educação Continuada
const educacaoContinuadaItems = [
  'Cursos e treinamentos',
  'Certificados',
  'Extrato de pontos',
];

export default function EducacaoPage({ onNavigate }) {
  const { canAccessCard } = useCardPermissions();

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      <div className="px-4 pt-4 sm:px-5">
        {/* Card: Educação Continuada (mesmo estilo do Comunicados) */}
        {canAccessCard('educacao_continuada') && (
          <div className="mb-3">
            <ComunicadosCard
              label="APRENDIZADO"
              title="Educação Continuada"
              badgeText="Acessar"
              items={educacaoContinuadaItems}
              onViewAll={() => onNavigate('educacaoContinuada')}
            />
          </div>
        )}

        {/* Grid de Widgets 2 colunas */}
        <div className="grid grid-cols-2 gap-3">
          {/* Desafio das ROPs */}
          {canAccessCard('rops_desafio') && (
            <WidgetCard
              icon={<Target className="w-6 h-6" />}
              title="Desafio ROPs"
              subtitle="Quiz gamificado Qmentum"
              variant="interactive"
              onClick={() => onNavigate('ropsDesafio')}
            />
          )}

          {/* Residência Médica */}
          {canAccessCard('residencia') && (
            <WidgetCard
              icon={<GraduationCap className="w-6 h-6" />}
              title="Residência Médica"
              subtitle="Calendário e estágios"
              variant="interactive"
              onClick={() => onNavigate('residencia')}
            />
          )}
        </div>

      </div>
    </div>
  );
}
