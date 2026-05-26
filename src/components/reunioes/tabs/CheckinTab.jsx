import { useMemo } from 'react';
import { SectionCard } from '@/design-system';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import CheckinCodeDisplay from '@/components/reunioes/CheckinCodeDisplay';
import CheckinCodeInput from '@/components/reunioes/CheckinCodeInput';

/**
 * CheckinTab — Check-in section: activate/deactivate check-in, CheckinCodeDisplay (organizer),
 * CheckinCodeInput (participant), check-in status indicator.
 */
export default function CheckinTab({
  reuniao,
  user,
  isOrganizer,
  isParticipant,
  allUsers,
  onDeactivateCheckin,
}) {
  const checkinCount = useMemo(() => Object.keys(reuniao?.checkins || {}).length, [reuniao]);
  const hasCheckedIn = useMemo(() => !!reuniao?.checkins?.[user?.uid || user?.id], [reuniao, user]);

  const participantesData = useMemo(() => {
    if (!reuniao?.participantesIds?.length) return [];
    return reuniao.participantesIds.map(id => {
      const u = allUsers.find(usr => usr.id === id);
      return { id, nome: u?.nome || u?.email || id };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [reuniao, allUsers]);

  const checkinsOrdenados = useMemo(() => {
    const ids = Object.keys(reuniao?.checkins || {});
    if (!ids.length) return [];
    return ids.map(id => participantesData.find(u => u.id === id) || { id, nome: id })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [reuniao, participantesData]);

  // Check-in not active — show informational state
  if (!reuniao?.checkinAtivo) {
    return (
      <SectionCard
        title="Check-in de Presença"
        icon={ShieldCheck}
      >
        <div className="text-center py-6">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {reuniao?.status === 'em_andamento'
              ? 'Check-in ainda não foi ativado pelo organizador. Use o menu ⋮ para ativar.'
              : 'Check-in disponível apenas durante a reunião (status "Em andamento").'}
          </p>
          {checkinCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {checkinCount} check-in(s) já realizados anteriormente.
            </p>
          )}
        </div>
      </SectionCard>
    );
  }

  // Check-in active
  return (
    <SectionCard
      title="Check-in de Presença"
      subtitle={`${checkinCount} de ${participantesData.length} confirmados`}
      icon={ShieldCheck}
    >
      {/* Organizador: mostra o código + lista live */}
      {isOrganizer && (
        <>
          <CheckinCodeDisplay
            seed={reuniao.checkinSeed}
            onDeactivate={onDeactivateCheckin}
          />
          {checkinCount > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Check-ins realizados ({checkinCount})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {checkinsOrdenados.map(p => (
                  <span
                    key={p.id}
                    className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success dark:bg-success/30"
                  >
                    {p.nome}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Participante: input do código ou confirmação */}
      {!isOrganizer && isParticipant && (
        hasCheckedIn ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle className="w-10 h-10 text-success" />
            <p className="text-sm font-medium text-success">
              Presenca confirmada!
            </p>
          </div>
        ) : (
          <CheckinCodeInput
            reuniaoId={reuniao.id}
            userId={user?.uid || user?.id}
            onSuccess={() => {}}
          />
        )
      )}

      {/* Observador não-convocado */}
      {!isOrganizer && !isParticipant && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Check-in ativo. Voce nao esta na lista de participantes.
        </p>
      )}
    </SectionCard>
  );
}
