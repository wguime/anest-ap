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
      {/* deitado: os MESMOS cards em duas colunas, preenchidas por LINHA — mesma
          regra da Home. Era multi-coluna e o fluxo por coluna enchia a esquerda
          com os dois cards altos, sem nenhuma linha se alinhar.
          ⚠️ CADA LINHA É INTEIRAMENTE SIMÉTRICA POR CONSTRUÇÃO, não por esticar
          (dono 26/08, 2ª rodada: "cards ficaram muito grandes... ficou esquisito").
          A 1ª tentativa foi `items-stretch`, e o problema era a origem do
          desencontro: à direita da 2ª linha não há um cartão, há a GRADE de
          widgets, que tem duas fileiras (292px medidos contra 151px do cartão ao
          lado). Esticar o cartão até 292px igualava a linha criando 141px de
          vão vazio dentro dele — daí o "muito grande".
          Agora cada linha tem PEÇAS IGUAIS: a 1ª junta os dois cartões de duas
          linhas (176px cada, já iguais sozinhos), o cartão de Comunicados ocupa a
          largura inteira e a grade de widgets vira UMA fileira de quatro. Sem
          esticar nada, sem vão vazio, e os widgets caem de 292px para 140px.
          As margens `mb-*` são zeradas: somariam ao `gap` e desalinhariam os
          topos. */}
      <div className="px-4 pt-4 sm:px-5 lg:px-6 xl:px-8 deitado:grid deitado:grid-cols-2 deitado:gap-3 deitado:pt-2 deitado:items-start [&>*]:deitado:mb-0">
        {/* Card: Notificações e Denúncias — variant "solid" (dono 19/08). É o único
            cartão pintado da aba: os três eram idênticos e ninguém achava o canal. */}
        {canAccessCard('incidentes') && (
          <div className="mb-3">
            <ComunicadosCard
              className="deitado:p-4"
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
              className="deitado:p-4"
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
        {/* ⚠️ deitado ocupa a linha inteira E a lista de títulos vai a duas
            colunas: sozinho numa das metades ele deixaria um buraco ao lado, e
            esticado na largura toda os dois títulos curtos deixavam 400px de
            vazio à direita. Em duas colunas a largura é usada e o cartão perde
            uma linha de altura. */}
        {canAccessCard('comunicados') && (
          <div className="mb-4 deitado:col-span-2">
            <ComunicadosCard
              className="deitado:p-4 [&_ul]:deitado:grid-cols-2 [&_ul]:deitado:mt-3"
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
        {/* ⚠️ deitado a grade ocupa a LARGURA INTEIRA e vira UMA fileira de quatro.
              Dentro de meia tela (~364px) ela ficava com duas fileiras — 292px, o
              dobro do cartão ao lado, e era essa a assimetria da 2ª linha. Em
              largura inteira cada widget fica com ~180px, mais que os ~176px que
              tem no retrato a 375px, então nenhum rótulo trunca (foi o que o
              `lg:grid-cols-3` fazia: "Qualidad", "Faturame"). */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 deitado:col-span-2 deitado:grid-cols-4">
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
