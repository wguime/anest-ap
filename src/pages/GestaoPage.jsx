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

// deitado cada atalho é um QUADRADO de 2 das 10 colunas da grade da página
// (dono 27/08: "os cards ficam simétricos e quadrados"). O `min-h-0` é o que tira
// os 140px de altura mínima do WidgetCard — sem ele o quadrado de ~134px não
// acontece e a fileira sai desalinhada.
const QUADRADO_DEITADO = 'deitado:col-span-2 deitado:aspect-square deitado:min-h-0'

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
      {/* deitado (dono 27/08): a aba vira DUAS FILEIRAS. Em cima os dois cartões
          de duas linhas, metade da largura cada; embaixo os CINCO menores —
          Comunicados e os quatro atalhos — todos QUADRADOS, do mesmo tamanho e
          alinhados numa fileira só.
          ⚠️ A grade é de DEZ colunas para as duas fileiras conviverem numa grade
          só: em cima cada cartão vale 5 colunas, embaixo cada quadrado vale 2. É
          o que permite Comunicados e atalhos ficarem lado a lado sendo eles, no
          DOM, um cartão e uma GRADE de quatro — a grade dos atalhos vira
          `contents` deitada e os quatro sobem para esta.
          Histórico de duas tentativas recusadas, para não voltarem: `items-stretch`
          esticava o cartão de Comunicados até a altura da grade de widgets e
          criava 141px de vão vazio dentro dele ("ficou esquisito"); e pôr
          Comunicados na largura inteira deixava dois títulos curtos espalhados
          por 720px. */}
      <div className="px-4 pt-4 sm:px-5 lg:px-6 xl:px-8 deitado:grid deitado:grid-cols-10 deitado:gap-3 deitado:pt-2 deitado:items-start [&>*]:deitado:mb-0">
        {/* Card: Notificações e Denúncias — variant "solid" (dono 19/08). É o único
            cartão pintado da aba: os três eram idênticos e ninguém achava o canal. */}
        {canAccessCard('incidentes') && (
          <div className="mb-3 deitado:col-span-5">
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
          <div className="mb-3 deitado:col-span-5">
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
        {/* ⚠️ deitado este cartão fica QUADRADO e do tamanho dos atalhos, e a
            LISTA DE TÍTULOS some (dono 27/08: "em comunicados deixe apenas o
            título no card"). Some por CSS e não tirando a prop `items`: sem ela o
            componente cai no outro modo dele (o feed estilo iOS Mail) e viraria
            outro cartão. O selo de não lidos fica — é o dado que faz alguém
            tocar. Em pé a lista continua. */}
        {canAccessCard('comunicados') && (
          <div className="mb-4 deitado:col-span-2">
            <ComunicadosCard
              className={[
                'deitado:aspect-square deitado:p-4',
                // a lista de títulos some (ver acima)
                '[&_ul]:deitado:hidden',
                // ⚠️ num quadrado de ~134px o cabeçalho do cartão precisa EMPILHAR:
                // ele é `flex justify-between` e, lado a lado, o selo "22 não
                // lidos" (85px) e o rótulo "COMUNICAÇÃO" (~95px) não cabem nos
                // 102px úteis — medido, o rótulo virava "CO" e o selo passava por
                // cima dele.
                '[&>header]:deitado:flex-col [&>header]:deitado:items-start [&>header]:deitado:gap-2',
                // ⚠️ e o TÍTULO desce para 15px, o mesmo dos atalhos ao lado:
                // "Comunicados" em 20px mede ~118px e é UMA palavra só, então não
                // quebra — vazava para fora do cartão. 15px é também o que faz os
                // cinco quadrados falarem no mesmo corpo de letra.
                '[&_h2]:deitado:text-[15px]',
              ].join(' ')}
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
        {/* ⚠️ deitado esta grade deixa de existir (`contents`) e os quatro atalhos
              viram filhos diretos da grade da PÁGINA — é assim que eles ficam na
              mesma fileira do cartão de Comunicados, que é irmão dela e não filho.
              Cada um leva `col-span-2` (2 de 10) e `aspect-square`; o `min-h` de
              140px do componente precisa sair junto, senão venceria o quadrado de
              ~134px e a fileira voltaria a ficar desigual. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 deitado:contents">
          {/* Qualidade - logo abaixo da Biblioteca */}
          {canAccessCard('qualidade') && (
            <WidgetCard
              icon={<Shield className="w-6 h-6" />}
              title="Qualidade"
              subtitle="Gestão da qualidade"
              className={QUADRADO_DEITADO}
              variant="interactive"
              onClick={() => onNavigate('qualidade')}
            />
          )}
          {canAccessCard('faturamento') && (
            <WidgetCard
              icon={<DollarSign className="w-6 h-6" />}
              title="Faturamento"
              subtitle="Gestão e faturamento"
              className={QUADRADO_DEITADO}
              variant="interactive"
              onClick={() => onNavigate('faturamento')}
            />
          )}
          {canAccessCard('escalas') && (
            <WidgetCard
              icon={<Calendar className="w-6 h-6" />}
              title="Escalas"
              subtitle="Gestão de escalas"
              className={QUADRADO_DEITADO}
              variant="interactive"
              onClick={() => onNavigate('escalas')}
            />
          )}
          {canAccessCard('reunioes') && (
            <WidgetCard
              icon={<Users className="w-6 h-6" />}
              title="Reuniões"
              subtitle="Gestão de reuniões"
              className={QUADRADO_DEITADO}
              variant="interactive"
              onClick={() => onNavigate('reunioes')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
