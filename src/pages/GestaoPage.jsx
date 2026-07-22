import { useEffect, useMemo } from 'react';
import { ComunicadosCard, WidgetCard } from '@/design-system';
import { DollarSign, Calendar, Shield, Users } from 'lucide-react';
import { useCardPermissions } from '../hooks/useCardPermissions';
import { useUser } from '../contexts/UserContext';
import { useComunicados } from '../contexts/ComunicadosContext';
import { isExpirado } from '@/utils/comunicadosHelpers';

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
  useEffect(() => {
    document.title = 'Gestão — ANEST';
  }, []);

  const { canAccessCard } = useCardPermissions();
  const { user } = useUser();
  const { publicados, isRead } = useComunicados();

  // Mesmo filtro da Home (role do user, não expirado/arquivado) — o card migrou
  // da Home p/ cá em 2026-07-22, mantendo recentes + contagem de não lidos.
  const userComunicados = useMemo(() => {
    if (!user?.id) return [];
    return publicados.filter((c) => {
      if (c.destinatarios?.length > 0) {
        if (!c.destinatarios.includes((user?.role || '').toLowerCase())) return false;
      }
      return !(c.arquivado || isExpirado(c));
    });
  }, [publicados, user]);

  const unreadComunicados = useMemo(() => {
    if (!user?.id) return 0;
    return userComunicados.filter((c) => !isRead(c, user.id)).length;
  }, [userComunicados, user, isRead]);

  const comunicadosItems = userComunicados.slice(0, 2).map((c) => c.titulo);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <h1 className="sr-only">Gestão</h1>
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
          <div className="mb-3">
            <ComunicadosCard
              label="DOCUMENTOS"
              title="Biblioteca de Documentos"
              badgeText="Acessar"
              items={bibliotecaItems}
              onViewAll={() => onNavigate('biblioteca')}
            />
          </div>
        )}

        {/* Card: Comunicados (migrado da Home 2026-07-22) — mesmo componente/tamanho
            da Biblioteca; títulos recentes como itens, não lidos no badge */}
        {canAccessCard('comunicados') && (
          <div className="mb-4">
            <ComunicadosCard
              label="COMUNICAÇÃO"
              title="Comunicados"
              badgeText={unreadComunicados > 0
                ? `${unreadComunicados} não lido${unreadComunicados > 1 ? 's' : ''}`
                : 'Ver todos'}
              items={comunicadosItems.length ? comunicadosItems : ['Nenhum comunicado recente']}
              onViewAll={() => onNavigate('comunicados')}
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
