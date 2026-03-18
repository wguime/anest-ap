/**
 * NovaReuniaoModal - Multi-step wizard for creating new meetings
 * 3-step wizard: Basic info → Context/Participants → Review
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Stepper,
  Input,
  Textarea,
  Select,
  DatePicker,
  FileUpload,
  Button,
  Spinner,
  useToast,
  cn,
} from '@/design-system';
import { Calendar, Clock, MapPin, Users, FileText, Check, UserCheck, CheckSquare, Square } from 'lucide-react';
import reunioesService from '@/services/reunioesService';
import { TIPOS_REUNIAO } from '@/pages/ReunioesPage';
import { useEventAlerts } from '@/contexts/EventAlertsContext';
import { useMessages } from '@/contexts/MessagesContext';
import { useUsersManagement } from '@/contexts/UsersManagementContext';

const STEPS = [
  { label: 'Dados Básicos', description: 'Informações principais' },
  { label: 'Contexto', description: 'Convocados e documentos' },
  { label: 'Revisão', description: 'Confirmar dados' },
];

const MODALIDADES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hibrida', label: 'Híbrida' },
];

// Perfis de usuário que podem ser convocados
const PERFIS_CONVOCADOS = [
  { key: 'anestesiologista', label: 'Anestesiologista', color: '#2563eb' },
  { key: 'medico-residente', label: 'Médico Residente', color: '#8b5cf6' },
  { key: 'enfermeiro', label: 'Enfermeiro', color: '#10b981' },
  { key: 'tec-enfermagem', label: 'Téc. Enfermagem', color: '#06b6d4' },
  { key: 'farmaceutico', label: 'Farmacêutico', color: '#ec4899' },
  { key: 'colaborador', label: 'Colaborador', color: '#6366f1' },
  { key: 'secretaria', label: 'Secretária', color: '#f59e0b' },
];

export default function NovaReuniaoModal({ isOpen, onClose, onSuccess, user }) {
  const { toast } = useToast();
  const { scheduleEventAlerts } = useEventAlerts();
  const { createSystemNotification } = useMessages();
  const { users: allUsers } = useUsersManagement();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic info
  const [tipo, setTipo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [dataReuniao, setDataReuniao] = useState(null);
  const [horario, setHorario] = useState('');
  const [local, setLocal] = useState('');
  const [modalidade, setModalidade] = useState('presencial');

  // Step 2: Context, roles, participants
  const [contexto, setContexto] = useState('');
  const [destinatariosTipos, setDestinatariosTipos] = useState([]);
  const [participantes, setParticipantes] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [subsidioFiles, setSubsidioFiles] = useState([]);

  // Users matching selected profiles
  const matchedUsers = useMemo(() => {
    if (destinatariosTipos.length === 0) return [];
    return allUsers
      .filter(u => u.active !== false && destinatariosTipos.includes(u.role))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [allUsers, destinatariosTipos]);

  // Track previous matched user IDs to detect additions/removals
  const prevMatchedIdsRef = useRef(new Set());

  // When profiles change, auto-select NEW users and remove deselected profiles' users
  useEffect(() => {
    const prevIds = prevMatchedIdsRef.current;
    const currentIds = new Set(matchedUsers.map(u => u.id));
    const newIds = [...currentIds].filter(id => !prevIds.has(id));
    const removedIds = new Set([...prevIds].filter(id => !currentIds.has(id)));

    setSelectedUserIds(prev => {
      const next = [...prev.filter(id => !removedIds.has(id)), ...newIds];
      const selectedNames = matchedUsers
        .filter(u => next.includes(u.id))
        .map(u => u.nome);
      setParticipantes(selectedNames.join('\n'));
      return next;
    });

    prevMatchedIdsRef.current = currentIds;
  }, [matchedUsers]);

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => {
      const next = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      // Update participantes text from selected users
      const selectedNames = matchedUsers
        .filter(u => next.includes(u.id))
        .map(u => u.nome);
      setParticipantes(selectedNames.join('\n'));
      return next;
    });
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.length === matchedUsers.length) {
      setSelectedUserIds([]);
      setParticipantes('');
    } else {
      const allIds = matchedUsers.map(u => u.id);
      setSelectedUserIds(allIds);
      setParticipantes(matchedUsers.map(u => u.nome).join('\n'));
    }
  };

  // Validation errors
  const [errors, setErrors] = useState({});

  // Get tipo configuration
  const tipoConfig = TIPOS_REUNIAO.find((t) => t.id === tipo);

  const togglePerfil = (key) => {
    setDestinatariosTipos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllPerfis = () => {
    if (destinatariosTipos.length === PERFIS_CONVOCADOS.length) {
      setDestinatariosTipos([]);
    } else {
      setDestinatariosTipos(PERFIS_CONVOCADOS.map((p) => p.key));
    }
  };

  const validateStep1 = () => {
    const newErrors = {};

    if (!tipo) newErrors.tipo = 'Selecione o tipo de reunião';
    if (!titulo.trim()) newErrors.titulo = 'Digite um título';
    if (!dataReuniao) newErrors.dataReuniao = 'Selecione a data';
    if (!horario) newErrors.horario = 'Digite o horário';
    if (!local.trim()) newErrors.local = 'Digite o local';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    return true;
  };

  const handleNext = () => {
    if (currentStep === 0 && !validateStep1()) return;
    if (currentStep === 1 && !validateStep2()) return;

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
    setErrors({});
  };

  const handleStepClick = (index) => {
    if (index <= currentStep) {
      setCurrentStep(index);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Create meeting
      const reuniaoData = {
        tipoReuniao: tipo,
        titulo,
        dataReuniao,
        horario,
        local,
        modalidade,
        contexto,
        destinatariosTipos,
        participantes,
        participantesIds: selectedUserIds,
        status: 'agendada',
      };

      const createdReuniao = await reunioesService.createReuniao(
        reuniaoData,
        {
          userId: user?.uid || user?.id,
          userName: user?.displayName || user?.email,
          userEmail: user?.email,
        }
      );

      // Upload subsídio files if any
      if (subsidioFiles.length > 0) {
        const uploadPromises = subsidioFiles.map((file) =>
          reunioesService.uploadDocumento(
            createdReuniao.id,
            file,
            'subsidio',
            { titulo: file.name },
            {
              userId: user?.uid || user?.id,
              userName: user?.displayName || user?.email,
              userEmail: user?.email,
            }
          )
        );

        await Promise.all(uploadPromises);
      }

      // Criar notificação na caixa de mensagens
      const perfilLabels = destinatariosTipos
        .map((key) => PERFIS_CONVOCADOS.find((p) => p.key === key)?.label)
        .filter(Boolean)
        .join(', ');

      createSystemNotification({
        category: 'reuniao',
        subject: `Nova reunião agendada: ${titulo}`,
        content: `${tipoConfig?.title || 'Reunião'} agendada para ${dataReuniao?.toLocaleDateString('pt-BR')} às ${horario}.\nLocal: ${local}${perfilLabels ? `\nConvocados: ${perfilLabels}` : ''}`,
        priority: 'normal',
        actionLabel: 'Ver detalhes',
      });

      // Agendar alertas de 1 dia e 1 hora antes (push notification)
      const eventDate = new Date(dataReuniao);
      if (horario) {
        const [h, m] = horario.split(':').map(Number);
        eventDate.setHours(h, m, 0, 0);
      }
      scheduleEventAlerts(
        `reuniao_${createdReuniao.id}`,
        titulo,
        eventDate.toISOString()
      );

      // Send in-app notifications to selected participants (optional)
      if (selectedUserIds.length > 0) {
        const selectedParticipants = matchedUsers
          .filter(u => selectedUserIds.includes(u.id))
          .map(u => ({ id: u.id, nome: u.nome || u.email }));

        reunioesService.notifyReuniaoParticipantes(
          createdReuniao.id,
          { titulo, dataReuniao, horario, local, tipoReuniao: tipo },
          selectedParticipants,
          { userId: user?.uid || user?.id, userName: user?.displayName || user?.email }
        ).catch(err => console.warn('Erro ao notificar participantes:', err));
      }

      toast({
        variant: 'success',
        title: 'Reunião criada!',
        description: 'A reunião foi agendada e os convocados serão notificados.',
        duration: 4000,
      });

      // Reset form
      resetForm();

      if (onSuccess) onSuccess(createdReuniao);
      onClose();
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        variant: 'error',
        title: 'Erro ao criar reunião',
        description: error.message || 'Não foi possível criar a reunião. Tente novamente.',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setTipo('');
    setTitulo('');
    setDataReuniao(null);
    setHorario('');
    setLocal('');
    setModalidade('presencial');
    setContexto('');
    setDestinatariosTipos([]);
    setParticipantes('');
    setSelectedUserIds([]);
    prevMatchedIdsRef.current = new Set();
    setSubsidioFiles([]);
    setErrors({});
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const handleFileChange = (files) => {
    if (files) {
      setSubsidioFiles([files]);
    } else {
      setSubsidioFiles([]);
    }
  };

  const footerButtons = (
    <div className="flex gap-3 w-full">
      <Button variant="outline" onClick={currentStep > 0 ? handleBack : handleClose} disabled={loading} className="flex-1">
        {currentStep > 0 ? 'Voltar' : 'Cancelar'}
      </Button>

      {currentStep < 2 ? (
        <Button onClick={handleNext} disabled={loading} className="flex-1">
          Próximo
        </Button>
      ) : (
        <Button onClick={handleSubmit} disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Criando...
            </>
          ) : (
            <>
              <Check size={18} className="mr-2" />
              Criar Reunião
            </>
          )}
        </Button>
      )}
    </div>
  );

  return (
    <Modal open={isOpen} onClose={handleClose} title="Nova Reunião" size="lg" footer={footerButtons}>
      <Modal.Body>
        <div className="space-y-6">
        {/* Stepper */}
        <Stepper
          currentStep={currentStep}
          steps={STEPS}
          onStepClick={handleStepClick}
          clickable
        />

        {/* Step 1: Basic Info */}
        {currentStep === 0 && (
          <div className="space-y-4">
            {/* Tipo */}
            <Select
              label="Tipo de Reunião *"
              placeholder="Selecione o tipo"
              value={tipo}
              onChange={setTipo}
              options={TIPOS_REUNIAO.map((t) => ({
                value: t.id,
                label: t.title,
              }))}
              error={errors.tipo}
            />

            {/* Título */}
            <Input
              label="Título *"
              placeholder="Ex: Comitê de Qualidade - Fevereiro 2026"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              error={errors.titulo}
            />

            {/* Data e Horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Data *"
                value={dataReuniao}
                onChange={setDataReuniao}
                placeholder="Selecione a data"
                minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                error={errors.dataReuniao}
              />

              <div className="grid gap-1.5">
                <label className="text-sm font-semibold text-primary">
                  Horário *
                </label>
                <div className="flex items-center gap-3 rounded-[16px] border-2 border-border py-4 px-[18px] bg-card">
                  <Clock size={20} className="shrink-0 text-primary" />
                  <input
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="flex-1 bg-transparent text-base text-foreground outline-none"
                  />
                </div>
                {errors.horario && (
                  <p className="text-sm text-destructive">{errors.horario}</p>
                )}
              </div>
            </div>

            {/* Local */}
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold text-primary">
                Local *
              </label>
              <div className="flex items-center gap-3 rounded-[16px] border-2 border-border py-4 px-[18px] bg-card">
                <MapPin size={20} className="shrink-0 text-primary" />
                <input
                  type="text"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex: Sala de Reuniões 1"
                  className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              {errors.local && (
                <p className="text-sm text-destructive">{errors.local}</p>
              )}
            </div>

            {/* Modalidade */}
            <Select
              label="Modalidade"
              value={modalidade}
              onChange={setModalidade}
              options={MODALIDADES}
            />
          </div>
        )}

        {/* Step 2: Context and Participants */}
        {currentStep === 1 && (
          <div className="space-y-4">
            {/* Contexto */}
            <Textarea
              label="Contexto"
              placeholder="Descreva o contexto e objetivos da reunião (opcional)"
              value={contexto}
              onChange={setContexto}
              rows={3}
            />

            {/* Perfis Convocados */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <UserCheck size={16} />
                  Perfis Convocados
                </label>
                <button
                  type="button"
                  onClick={selectAllPerfis}
                  className="text-xs text-primary hover:underline"
                >
                  {destinatariosTipos.length === PERFIS_CONVOCADOS.length ? 'Limpar' : 'Todos'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Selecione quais perfis devem ver esta reunião. Se nenhum for selecionado, todos verão.
              </p>
              <div className="flex flex-wrap gap-2">
                {PERFIS_CONVOCADOS.map((perfil) => {
                  const isSelected = destinatariosTipos.includes(perfil.key);
                  return (
                    <button
                      key={perfil.key}
                      type="button"
                      onClick={() => togglePerfil(perfil.key)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        isSelected
                          ? 'text-white border-transparent'
                          : 'bg-card text-muted-foreground border-border hover:border-primary'
                      )}
                      style={isSelected ? { backgroundColor: perfil.color } : undefined}
                    >
                      {perfil.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Participantes */}
            <div className="grid gap-1.5">
              <label className="text-sm font-semibold text-primary flex items-center gap-1.5">
                <Users size={16} />
                Participantes (nomes)
              </label>
              {matchedUsers.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {selectedUserIds.length} de {matchedUsers.length} selecionados
                    </p>
                    <button
                      type="button"
                      onClick={toggleAllUsers}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedUserIds.length === matchedUsers.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                  <div className="rounded-[16px] border-2 border-border bg-card overflow-hidden">
                    <div className="max-h-[200px] overflow-y-auto overscroll-contain divide-y divide-border">
                      {matchedUsers.map((user) => {
                        const isSelected = selectedUserIds.includes(user.id);
                        const perfil = PERFIS_CONVOCADOS.find(p => p.key === user.role);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleUserSelection(user.id)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                            )}
                          >
                            {isSelected ? (
                              <CheckSquare size={18} className="text-primary flex-shrink-0" />
                            ) : (
                              <Square size={18} className="text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-sm truncate',
                                isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'
                              )}>
                                {user.nome || user.email}
                              </p>
                            </div>
                            {perfil && (
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                                style={{ backgroundColor: perfil.color }}
                              >
                                {perfil.label}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-[16px] border-2 border-border py-4 px-[18px] bg-card">
                  <Users size={20} className="shrink-0 text-primary mt-1" />
                  <textarea
                    value={participantes}
                    onChange={(e) => setParticipantes(e.target.value)}
                    placeholder="Selecione perfis acima para ver participantes, ou digite manualmente (opcional)"
                    rows={3}
                    className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* Documentos Subsídio */}
            <FileUpload
              label="Documentos Subsídio"
              accept=".pdf,.doc,.docx"
              variant="button"
              value={subsidioFiles[0] || null}
              onChange={handleFileChange}
              disabled={loading}
              description="PDF, DOC ou DOCX"
            />
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary border border-border p-4 space-y-4">
              {/* Tipo */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {tipoConfig && <tipoConfig.icon className="w-4 h-4" style={{ color: tipoConfig.color }} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Tipo de Reunião</p>
                  <p className="text-sm font-semibold text-foreground">
                    {tipoConfig?.title || tipo}
                  </p>
                </div>
              </div>

              {/* Título */}
              <div>
                <p className="text-xs text-muted-foreground">Título</p>
                <p className="text-sm font-semibold text-foreground">{titulo}</p>
              </div>

              {/* Data e Horário */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-semibold text-foreground">
                    {dataReuniao?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="text-sm font-semibold text-foreground">{horario}</p>
                </div>
              </div>

              {/* Local e Modalidade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="text-sm font-semibold text-foreground">{local}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modalidade</p>
                  <p className="text-sm font-semibold text-foreground">
                    {MODALIDADES.find((m) => m.value === modalidade)?.label}
                  </p>
                </div>
              </div>

              {/* Perfis Convocados */}
              {destinatariosTipos.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Perfis Convocados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {destinatariosTipos.map((key) => {
                      const perfil = PERFIS_CONVOCADOS.find((p) => p.key === key);
                      if (!perfil) return null;
                      return (
                        <span
                          key={key}
                          className="text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: perfil.color }}
                        >
                          {perfil.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {destinatariosTipos.length === 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Perfis Convocados</p>
                  <p className="text-sm text-foreground">Todos os perfis</p>
                </div>
              )}

              {/* Contexto */}
              {contexto && (
                <div>
                  <p className="text-xs text-muted-foreground">Contexto</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{contexto}</p>
                </div>
              )}

              {/* Participantes */}
              {selectedUserIds.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Participantes ({selectedUserIds.length} convocados)
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto overscroll-contain">
                    {matchedUsers
                      .filter(u => selectedUserIds.includes(u.id))
                      .map(u => (
                        <span
                          key={u.id}
                          className="text-xs px-2 py-0.5 rounded-full bg-accent text-primary font-medium"
                        >
                          {u.nome || u.email}
                        </span>
                      ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Estes participantes receberão notificações da reunião e lembretes.
                  </p>
                </div>
              ) : participantes ? (
                <div>
                  <p className="text-xs text-muted-foreground">Participantes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{participantes}</p>
                </div>
              ) : null}

              {/* Documentos */}
              {subsidioFiles.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Documentos Subsídio</p>
                  <div className="space-y-2">
                    {subsidioFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border"
                      >
                        <FileText size={16} className="text-primary" />
                        <span className="text-sm text-foreground">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      </Modal.Body>
    </Modal>
  );
}
