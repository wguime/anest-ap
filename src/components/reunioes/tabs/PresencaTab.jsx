import { useState, useEffect, useMemo, useCallback } from 'react';
import { SectionCard, Button, Textarea, useToast, Checkbox } from '@/design-system';
import { CheckCircle, AlertCircle, UserCheck, Edit3 } from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import reunioesService from '@/services/reunioesService';
import ExportPresencaButton from '@/components/reunioes/ExportPresencaButton';

/**
 * PresencaTab — Attendance: participant list with present/absent status, edit mode (Checkbox DS),
 * justificativa input, manual presence registration.
 */
export default function PresencaTab({
  reuniao,
  reuniaoId,
  user,
  canManageAll,
  isParticipant,
  canEditPresenca,
  allUsers,
  onReload,
}) {
  const { toast } = useToast();

  // Derive participant data from allUsers
  const participantesData = useMemo(() => {
    if (!reuniao?.participantesIds?.length) return [];
    return reuniao.participantesIds.map(id => {
      const u = allUsers.find(usr => usr.id === id);
      return { id, nome: u?.nome || u?.email || id, role: u?.role };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [reuniao, allUsers]);

  const sortIds = useCallback((ids) => {
    if (!ids?.length) return [];
    return ids.map(id => participantesData.find(u => u.id === id) || { id, nome: id })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [participantesData]);

  const presentesOrdenados = useMemo(() => sortIds(reuniao?.presentes), [reuniao, sortIds]);
  const faltantesOrdenados = useMemo(() => sortIds(reuniao?.faltantes), [reuniao, sortIds]);

  const [editingPresenca, setEditingPresenca] = useState(false);
  const [presentes, setPresentes] = useState([]);
  const [savingPresenca, setSavingPresenca] = useState(false);
  const [justificativaFalta, setJustificativaFalta] = useState('');
  const [mostrandoFormFalta, setMostrandoFormFalta] = useState(false);

  // Init presentes from saved data
  useEffect(() => {
    setPresentes(Array.isArray(reuniao?.presentes) ? reuniao.presentes : []);
  }, [reuniao]);

  // Hidrata a justificativa quando o próprio usuário está marcado como ausente
  useEffect(() => {
    const uid = user?.uid || user?.id;
    if (!uid) return;
    if (reuniao?.justificativasFaltas?.[uid]) {
      setJustificativaFalta(reuniao.justificativasFaltas[uid]);
    } else if (!reuniao?.faltantes?.includes(uid)) {
      setJustificativaFalta('');
    }
  }, [reuniao, user]);

  // Self-presença do participante: presente / ausente / nao-registrado
  const selfPresencaStatus = useMemo(() => {
    const uid = user?.uid || user?.id;
    if (!uid) return 'nao-registrado';
    if (reuniao?.presentes?.includes(uid)) return 'presente';
    if (reuniao?.faltantes?.includes(uid) && reuniao?.justificativasFaltas?.[uid]) {
      return 'ausente';
    }
    return 'nao-registrado';
  }, [reuniao, user]);

  const handleSelfPresenca = useCallback(async (present, justificativa = '') => {
    try {
      setSavingPresenca(true);
      await reunioesService.registerSelfPresenca(
        reuniaoId,
        user?.uid || user?.id,
        present,
        justificativa
      );
      setMostrandoFormFalta(false);
      if (present) setJustificativaFalta('');
      toast({
        variant: 'success',
        title: present ? 'Presença confirmada!' : 'Ausência registrada',
      });
      await onReload();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao registrar', description: error.message });
    } finally {
      setSavingPresenca(false);
    }
  }, [reuniaoId, user, toast, onReload]);

  // Handler para salvar presença (gerencial — organizador/admin)
  const handleSavePresenca = async () => {
    try {
      setSavingPresenca(true);
      const faltantesIds = participantesData.filter(p => !presentes.includes(p.id)).map(p => p.id);

      // Preserva apenas as justificativas de quem AINDA está em faltantes
      const previas = reuniao?.justificativasFaltas || {};
      const justificativasFaltas = {};
      for (const id of faltantesIds) {
        if (previas[id]) justificativasFaltas[id] = previas[id];
      }

      await reunioesService.updateReuniao(reuniaoId, {
        presentes,
        faltantes: faltantesIds,
        justificativasFaltas,
      });
      setEditingPresenca(false);
      toast({ variant: 'success', title: 'Presença registrada!' });
      await onReload();
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSavingPresenca(false);
    }
  };

  // Show empty state if no participants or cannot edit
  if (!canEditPresenca || participantesData.length === 0 || (!canManageAll && !isParticipant)) {
    return (
      <SectionCard title="Presença">
        <div className="text-center py-6">
          <UserCheck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {!canEditPresenca
              ? 'Presença disponível durante ou após a reunião.'
              : 'Nenhum participante nesta reunião.'}
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={canManageAll ? 'Presença (Manual)' : 'Minha Presença'}
      subtitle={canManageAll
        ? `${reuniao.presentes?.length || 0} presentes, ${reuniao.faltantes?.length || 0} faltantes`
        : 'Confirme sua própria participação nesta reunião'
      }
    >
      {/* --- Modo participante: self-service --- */}
      {!canManageAll && isParticipant && (() => {
        const justificativaValida = justificativaFalta.trim().length >= 3;
        const readOnly = reuniao.status === 'concluida';

        // Formulário de justificativa
        if (mostrandoFormFalta) {
          return (
            <div className="space-y-3">
              <Textarea
                label="Justificativa da ausência *"
                placeholder="Descreva o motivo da sua ausência (mínimo 3 caracteres)"
                value={justificativaFalta}
                onChange={setJustificativaFalta}
                rows={3}
                maxLength={500}
                showCount
                disabled={savingPresenca}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMostrandoFormFalta(false);
                    const uid = user?.uid || user?.id;
                    setJustificativaFalta(reuniao?.justificativasFaltas?.[uid] || '');
                  }}
                  disabled={savingPresenca}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSelfPresenca(false, justificativaFalta)}
                  disabled={savingPresenca || !justificativaValida}
                  className="flex-1"
                >
                  {savingPresenca ? 'Salvando...' : 'Registrar ausência'}
                </Button>
              </div>
            </div>
          );
        }

        if (selfPresencaStatus === 'presente') {
          return (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle className="w-10 h-10 text-success" />
                <p className="text-sm font-medium text-success">
                  Sua presença está confirmada
                </p>
              </div>
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMostrandoFormFalta(true)}
                  disabled={savingPresenca}
                  className="w-full"
                >
                  Registrar ausência
                </Button>
              )}
            </div>
          );
        }

        if (selfPresencaStatus === 'ausente') {
          const uid = user?.uid || user?.id;
          const textoSalvo = reuniao?.justificativasFaltas?.[uid] || '';
          return (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 py-2">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  Você registrou ausência
                </p>
              </div>
              {textoSalvo && (
                <div className="rounded-xl bg-muted/60 border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Justificativa:</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{textoSalvo}</p>
                </div>
              )}
              {!readOnly && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrandoFormFalta(true)}
                    disabled={savingPresenca}
                    className="flex-1"
                  >
                    Editar justificativa
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSelfPresenca(true)}
                    disabled={savingPresenca}
                    className="flex-1"
                  >
                    {savingPresenca ? 'Salvando...' : 'Confirmar presença'}
                  </Button>
                </div>
              )}
            </div>
          );
        }

        // nao-registrado
        return (
          <div className="space-y-3">
            <div className="text-center py-4">
              <UserCheck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Confirme sua participação nesta reunião.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMostrandoFormFalta(true)}
                disabled={savingPresenca}
                className="flex-1"
              >
                Não participei
              </Button>
              <Button
                size="sm"
                onClick={() => handleSelfPresenca(true)}
                disabled={savingPresenca}
                className="flex-1"
              >
                {savingPresenca ? 'Salvando...' : 'Estou presente'}
              </Button>
            </div>
          </div>
        );
      })()}

      {/* --- Modo organizador/admin: gerencia lista completa --- */}
      {canManageAll && !editingPresenca && (
        <div>
          {reuniao.presentes?.length || reuniao.faltantes?.length ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-sm font-medium text-foreground">
                  Presentes ({reuniao.presentes?.length || 0})
                </span>
              </div>
              {presentesOrdenados.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presentesOrdenados.map(p => (
                    <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success dark:bg-success/30">
                      {p.nome}
                    </span>
                  ))}
                </div>
              )}
              {reuniao.faltantes?.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-sm font-medium text-foreground">
                      Faltantes ({reuniao.faltantes.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {faltantesOrdenados.map(p => {
                      const justificativa = reuniao.justificativasFaltas?.[p.id];
                      return (
                        <div
                          key={p.id}
                          className="flex items-start gap-2 text-xs px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20"
                        >
                          <span className="font-medium text-destructive whitespace-nowrap">
                            {p.nome}
                          </span>
                          {justificativa ? (
                            <span className="text-destructive/80 flex-1 whitespace-pre-wrap">
                              — {justificativa}
                            </span>
                          ) : (
                            <span className="italic text-destructive/60 flex-1">
                              — sem justificativa
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingPresenca(true)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar Presença
                </Button>
                <ExportPresencaButton reuniao={reuniao} allUsers={allUsers} />
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <UserCheck className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Nenhuma presença registrada ainda. Participantes podem confirmar pela própria conta.
              </p>
              <Button variant="outline" size="sm" onClick={() => setEditingPresenca(true)}>
                <UserCheck className="w-4 h-4 mr-2" />
                Registrar Presença
              </Button>
            </div>
          )}
        </div>
      )}

      {canManageAll && editingPresenca && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {presentes.length} de {participantesData.length} presentes
            </p>
            <button
              type="button"
              onClick={() => setPresentes(
                presentes.length === participantesData.length
                  ? []
                  : participantesData.map(p => p.id)
              )}
              className="text-xs text-primary hover:underline"
            >
              {presentes.length === participantesData.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
              {participantesData.map(p => {
                const isPresent = presentes.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'w-full px-4 py-1 transition-colors',
                      isPresent ? 'bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <Checkbox
                      checked={isPresent}
                      onChange={() => setPresentes(prev =>
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      )}
                      label={p.nome}
                      size="sm"
                      compact
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPresenca(false);
                setPresentes(Array.isArray(reuniao?.presentes) ? reuniao.presentes : []);
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSavePresenca}
              disabled={savingPresenca}
              className="flex-1"
            >
              {savingPresenca ? 'Salvando...' : 'Salvar Presença'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
