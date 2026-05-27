import { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Progress, RadioGroup, Avatar, useToast } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { DELIBERACAO_STATUS, DELIBERACAO_TIPOS, VOTO_OPTIONS, VOTO_VARIANT_MAP } from '@/constants/reunioes';
import { EyeOff, CheckCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import reunioesService from '@/services/reunioesService';

/**
 * VotacaoCard — Displays a single deliberação with voting UI, results, and management actions.
 * Handles both identified and anonymous voting modes.
 */
export default function VotacaoCard({ deliberacao, user, canManageAll, allUsers, reuniao, onReload }) {
  const { toast } = useToast();

  const [selectedVoto, setSelectedVoto] = useState(null);
  const [hasUserVoted, setHasUserVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showVoters, setShowVoters] = useState(false);

  const userId = user?.uid || user?.id;
  const resultado = deliberacao.resultado || { favor: 0, contra: 0, abstencao: 0, total: 0 };
  const total = resultado.total || 0;
  const statusConfig = DELIBERACAO_STATUS[deliberacao.status] || DELIBERACAO_STATUS.aberta;
  const tipoConfig = DELIBERACAO_TIPOS.find(t => t.value === deliberacao.tipo) || DELIBERACAO_TIPOS[0];

  // Check if user has already voted
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!userId || !deliberacao) return;
      try {
        const voted = await reunioesService.hasVoted(deliberacao, userId);
        if (!cancelled) setHasUserVoted(voted);
      } catch {
        // Fail silently — default to not voted
      }
    }
    check();
    return () => { cancelled = true; };
  }, [deliberacao, userId]);

  // Vote handler
  const handleVote = useCallback(async () => {
    if (!selectedVoto || !userId) return;

    try {
      setVoting(true);
      if (deliberacao.isAnonima) {
        await reunioesService.votarAnonimo(deliberacao.id, userId, selectedVoto);
      } else {
        const nome = user?.displayName || user?.email || 'Participante';
        await reunioesService.votarIdentificado(deliberacao.id, userId, selectedVoto, nome);
      }
      toast({ variant: 'success', title: 'Voto registrado!' });
      setHasUserVoted(true);
      setSelectedVoto(null);
      await onReload?.();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao votar', description: error.message });
    } finally {
      setVoting(false);
    }
  }, [selectedVoto, userId, deliberacao, user, toast, onReload]);

  // Close handler
  const handleClose = useCallback(async (finalStatus) => {
    try {
      setClosing(true);
      const callerInfo = {
        userId: user?.uid || user?.id,
        userName: user?.displayName || user?.email,
        userEmail: user?.email,
      };
      await reunioesService.fecharDeliberacao(deliberacao.id, finalStatus, callerInfo);
      toast({ variant: 'success', title: `Deliberação ${DELIBERACAO_STATUS[finalStatus]?.label?.toLowerCase() || finalStatus}` });
      await onReload?.();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao encerrar', description: error.message });
    } finally {
      setClosing(false);
    }
  }, [deliberacao.id, user, toast, onReload]);

  // Resolve voter names from allUsers
  const getVotersList = useCallback(() => {
    if (deliberacao.isAnonima || !deliberacao.votos) return [];
    return Object.entries(deliberacao.votos).map(([voterId, voteData]) => {
      const u = allUsers?.find(usr => usr.id === voterId);
      return {
        id: voterId,
        nome: voteData.nome || u?.nome || u?.email || voterId,
        voto: voteData.voto,
      };
    });
  }, [deliberacao, allUsers]);

  // Format creation date
  const createdAtStr = deliberacao.createdAt
    ? new Date(deliberacao.createdAt instanceof Date ? deliberacao.createdAt : deliberacao.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  // Get creator name
  const creatorName = (() => {
    if (deliberacao.createdByName) return deliberacao.createdByName;
    const creator = allUsers?.find(u => u.id === deliberacao.createdBy);
    return creator?.nome || creator?.email || 'Desconhecido';
  })();

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.[0] || '?').toUpperCase();
  };

  const voters = getVotersList();

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm space-y-3">
      {/* Header: numero + titulo + status */}
      <div className="flex items-start gap-2 flex-wrap">
        <Badge variant="secondary" badgeStyle="subtle" className="shrink-0">
          {deliberacao.numero}
        </Badge>
        <h4 className="text-sm font-bold text-foreground flex-1 min-w-0">{deliberacao.titulo}</h4>
        <Badge
          variant={statusConfig.variant}
          badgeStyle="subtle"
          className="shrink-0"
        >
          {statusConfig.label}
        </Badge>
      </div>

      {/* Tipo badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={tipoConfig.variant} badgeStyle="subtle" dot>
          {tipoConfig.label}
        </Badge>
        {deliberacao.isAnonima && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            Votação anônima
          </span>
        )}
      </div>

      {/* Description */}
      {deliberacao.descricao && (
        <p className="text-sm text-foreground">{deliberacao.descricao}</p>
      )}

      {/* Voting section (when status === aberta) */}
      {deliberacao.status === 'aberta' && (
        <div className="pt-1">
          {hasUserVoted ? (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle className="w-5 h-5 text-success" aria-hidden="true" />
              <span className="text-sm font-medium text-success">Voto registrado</span>
            </div>
          ) : (
            <div className="space-y-3">
              <RadioGroup
                options={VOTO_OPTIONS}
                value={selectedVoto}
                onChange={setSelectedVoto}
                orientation="horizontal"
                aria-label="Escolha seu voto"
              />
              <Button
                size="sm"
                onClick={handleVote}
                disabled={!selectedVoto || voting}
                className="w-full min-h-[44px]"
                aria-label="Registrar voto"
              >
                {voting ? 'Votando...' : 'Votar'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results section */}
      <div className="space-y-2 pt-1">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Progress
              value={total > 0 ? (resultado.favor / total) * 100 : 0}
              variant="success"
              size="sm"
              label="A favor"
              className="flex-1"
            />
            <Badge variant="success" badgeStyle="subtle" className="shrink-0 text-xs">
              {resultado.favor}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Progress
              value={total > 0 ? (resultado.contra / total) * 100 : 0}
              variant="error"
              size="sm"
              label="Contra"
              className="flex-1"
            />
            <Badge variant="destructive" badgeStyle="subtle" className="shrink-0 text-xs">
              {resultado.contra}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Progress
              value={total > 0 ? (resultado.abstencao / total) * 100 : 0}
              variant="default"
              size="sm"
              label="Abstenção"
              className="flex-1"
            />
            <Badge variant="secondary" badgeStyle="subtle" className="shrink-0 text-xs">
              {resultado.abstencao}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{total} voto(s)</p>
      </div>

      {/* Identified voters list (non-anonymous + admin, collapsible) */}
      {!deliberacao.isAnonima && canManageAll && voters.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowVoters(prev => !prev)}
            className={cn(
              'flex items-center gap-1 text-xs text-primary hover:underline',
              'min-h-[44px] px-1'
            )}
            aria-expanded={showVoters}
            aria-label={showVoters ? 'Ocultar votos' : `Ver votos (${voters.length})`}
          >
            {showVoters ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                Ocultar votos
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                Ver votos ({voters.length})
              </>
            )}
          </button>

          {showVoters && (
            <div className="mt-2 space-y-1.5">
              {voters.map(voter => (
                <div key={voter.id} className="flex items-center gap-2 px-1 py-1">
                  <Avatar size="xs" className="shrink-0">
                    {getInitials(voter.nome)}
                  </Avatar>
                  <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                    {voter.nome}
                  </span>
                  <Badge
                    variant={VOTO_VARIANT_MAP[voter.voto] || 'secondary'}
                    badgeStyle="subtle"
                    className="shrink-0"
                  >
                    {VOTO_OPTIONS.find(o => o.value === voter.voto)?.label || voter.voto}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Close actions (admin/organizer + aberta) */}
      {canManageAll && deliberacao.status === 'aberta' && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose('aprovada')}
            disabled={closing}
            className="flex-1 min-h-[44px] text-success border-success/30 hover:bg-success/10"
            aria-label="Aprovar deliberação"
          >
            <CheckCircle className="w-4 h-4 mr-1" aria-hidden="true" />
            Aprovar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose('rejeitada')}
            disabled={closing}
            className="flex-1 min-h-[44px] text-destructive border-destructive/30 hover:bg-destructive/10"
            aria-label="Rejeitar deliberação"
          >
            <Lock className="w-4 h-4 mr-1" aria-hidden="true" />
            Rejeitar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClose('adiada')}
            disabled={closing}
            className="flex-1 min-h-[44px] text-warning border-warning/30 hover:bg-warning/10"
            aria-label="Adiar deliberação"
          >
            Adiar
          </Button>
        </div>
      )}

      {/* Footer: creator + date */}
      <p className="text-xs text-muted-foreground pt-1">
        Criada por {creatorName}{createdAtStr ? ` • ${createdAtStr}` : ''}
      </p>
    </div>
  );
}
