import { useEffect, useMemo } from 'react';
import { ComunicadosCard, WidgetCard } from '@/design-system';
import { DollarSign, Calendar, Shield, Users } from 'lucide-react';
import { useCardPermissions } from '../hooks/useCardPermissions';
import { useUser } from '../contexts/UserContext';
import { useComunicados } from '../contexts/ComunicadosContext';
import { isExpirado } from '@/utils/comunicadosHelpers';

// Dados para o card de Notificações e Denúncias
const incidentesItems = [
  'Evento adverso, near miss ou queixa',
  'Canal sigiloso de denúncia',
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
      {/* deitado: os MESMOS cards em duas colunas — mesma solução da Home.
          Multi-coluna respeita o `mb-3` de cada card e não mexe no DOM;
          `break-inside-avoid` impede um card de partir no pé da coluna. */}
      <div className="px-4 pt-4 sm:px-5 lg:px-6 xl:px-8 deitado:columns-2 deitado:gap-3 deitado:pt-2 [&>*]:deitado:break-inside-avoid">
        {/* Card: Notificações e Denúncias — variant "solid" (dono 19/08). É o único
            cartão pintado da aba: os três eram idênticos e ninguém achava o canal. */}
        {canAccessCard('incidentes') && (
          <div className="mb-3">
            <ComunicadosCard
              variant="solid"
              label="SEGURANÇA"
              title="Notificações e Denúncias"
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
        {/* ⚠️ deitado esta grade vive DENTRO de uma das duas colunas (~370px):
              o `lg:grid-cols-3` que a largura de 844px ativaria trunca os rótulos
              ("Qualidad", "Faturame" — visto no app). Volta a duas. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 deitado:grid-cols-2">
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
