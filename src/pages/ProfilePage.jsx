import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '../contexts/UserContext';
import { useEventAlerts } from '../contexts/EventAlertsContext';
import { useMessages } from '../contexts/MessagesContext';
import { useTheme } from '@/design-system';
import { exportUserData, downloadAsJson, requestDeletion } from '@/services/lgpdService';
import { supabase } from '@/config/supabase';
import {
  Card,
  CardContent,
  Avatar,
  Badge,
  Button,
  Input,
  Switch,
  useToast,
} from '@/design-system';
import { Camera, Trash2, Download, Moon, Sun, Bell, MessageSquare, LogOut, Settings, Shield, X, Key, Calendar, Check, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react';
import { isAdministrator } from '@/design-system/components/anest/admin-only';

export default function ProfilePage({ onNavigate, goBack }) {
  const { user, updateUser, updateAvatar, logout } = useUser();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount: eventAlertsUnread } = useEventAlerts();
  const { totalUnreadCount } = useMessages();
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  // Contagem combinada de mensagens + alertas de eventos
  const combinedUnreadCount = totalUnreadCount + eventAlertsUnread;

  // Estados para modais (hooks devem vir antes do early return)
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [notifications, setNotifications] = useState(true);

  // Estado do formulário de edição (inicializa com valores vazios, será atualizado ao editar)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    crm: '',
    especialidade: '',
  });

  // Estado do formulário de senha
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  const [exportingData, setExportingData] = useState(false);
  const [lgpdExpanded, setLgpdExpanded] = useState(false);

  const [lgpdStatus, setLgpdStatus] = useState(null); // null = not loaded, [] = no requests

  useEffect(() => {
    if (!user?.uid && !user?.id) return;
    const userId = user.uid || user.id;

    async function fetchLgpdStatus() {
      try {
        const { data } = await supabase
          .from('lgpd_solicitacoes')
          .select('id, status, tipo, created_at, resolved_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        setLgpdStatus(data || []);
      } catch (err) {
        console.warn('[ProfilePage] Failed to fetch LGPD status:', err);
        setLgpdStatus([]);
      }
    }
    fetchLgpdStatus();
  }, [user?.uid, user?.id]);

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const data = await exportUserData(user.uid || user.id, user);
      if (data.errors && data.errors.length > 0) {
        toast({
          title: 'Alguns dados nao puderam ser exportados',
          description: `${data.errors.length} fonte(s) com erro`,
          variant: 'warning',
        });
      }
      downloadAsJson(data);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({ title: 'Erro ao exportar dados. Tente novamente.', variant: 'destructive' });
    } finally {
      setExportingData(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!confirm('Tem certeza que deseja solicitar a exclusão dos seus dados? Esta ação será enviada para análise do administrador.')) return;
    try {
      await requestDeletion(user.uid || user.id, user);
      toast({ title: 'Solicitação de exclusão registrada. O administrador será notificado.', variant: 'success' });
    } catch (error) {
      console.error('Error requesting deletion:', error);
      toast({ title: 'Erro ao registrar solicitação. Tente novamente.', variant: 'destructive' });
    }
  };

  // Early return se user não existe (evita erro ao acessar propriedades)
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const result = await updateAvatar(file);
    setUploadingAvatar(false);
    if (!result.success) {
      toast({ title: 'Erro ao salvar foto. Tente novamente.', variant: 'destructive' });
    }
  };

  const handleDeletePhoto = async () => {
    setUploadingAvatar(true);
    await updateAvatar(null);
    setUploadingAvatar(false);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = () => {
    updateUser(editForm);
    setIsEditing(false);
  };

  const openEditModal = () => {
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      crm: user.crm,
      especialidade: user.especialidade,
    });
    setIsEditing(true);
  };

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordError('');
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Preencha todos os campos');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    // Aqui seria a integração com Firebase Auth
    // Por enquanto, apenas simula sucesso
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsChangingPassword(false);
    // showToast('Senha alterada com sucesso!', 'success');
  };

  const handleLogout = () => {
    logout();
    // Redirect to login or home
  };

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Meu Perfil
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8">
        {/* Avatar com botões de upload e excluir */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <Avatar
              size="xl"
              initials={`${user.firstName?.[0] || '?'}${user.lastName?.[0] || '?'}`}
              src={user.avatar}
            />
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className="absolute -bottom-1 right-0 flex gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white dark:text-foreground shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
              </button>
              {user.avatar && (
                <button
                  onClick={handleDeletePhoto}
                  disabled={uploadingAvatar}
                  className="w-9 h-9 rounded-full bg-destructive flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          <h2 className="mt-4 text-xl font-bold text-black dark:text-white">
            Dr. {user.firstName} {user.lastName}
          </h2>
          <Badge variant="success" className="mt-2">
            {user.role}
          </Badge>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.email}
          </p>
        </div>

        {/* Caixa de Mensagens - Navega para InboxPage */}
        <Card
          variant="highlight"
          className="mb-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('inbox')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-white dark:text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-black dark:text-white">Caixa de Mensagens</h3>
                {combinedUnreadCount > 0 && <Badge variant="destructive" count={combinedUnreadCount} />}
              </div>
              <p className="text-sm text-muted-foreground">
                {combinedUnreadCount > 0
                  ? `${combinedUnreadCount} mensage${combinedUnreadCount > 1 ? 'ns' : 'm'} nao lida${combinedUnreadCount > 1 ? 's' : ''}`
                  : 'Nenhuma mensagem pendente'}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>

        {/* Informações Profissionais */}
        <Card variant="default" className="mb-4 bg-muted">
          <CardContent className="p-4">
            <h3 className="font-semibold text-black dark:text-white mb-3">
              Informações Profissionais
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">CRM</span>
                <span className="text-sm font-medium text-black dark:text-white">{user.crm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Especialidade</span>
                <span className="text-sm font-medium text-black dark:text-white">{user.especialidade}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card variant="default" className="mb-4">
          <CardContent className="p-4">
            <h3 className="font-semibold text-black dark:text-white mb-3">
              Configurações
            </h3>
            <div className="space-y-2">
              {/* Modo Escuro - usando Switch do DS */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-primary" />
                  )}
                  <span className="text-sm text-black dark:text-white">Modo Escuro</span>
                </div>
                <Switch
                  checked={isDark}
                  onChange={toggleTheme}
                  size="md"
                />
              </div>

              {/* Notificações - usando Switch do DS */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-primary" />
                  <span className="text-sm text-black dark:text-white">Notificações</span>
                </div>
                <Switch
                  checked={notifications}
                  onChange={setNotifications}
                  size="md"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <Card variant="default" className="mb-4 overflow-hidden">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={openEditModal}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted dark:hover:bg-muted transition-colors"
            >
              <Settings className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-black dark:text-white">Editar Perfil</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </button>
            <div className="border-t border-[#E5E7EB] dark:border-border mx-4" />
            <button
              type="button"
              onClick={() => setIsChangingPassword(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted dark:hover:bg-muted transition-colors"
            >
              <Key className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-black dark:text-white">Alterar Senha</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </button>
            {isAdministrator(user) && (
              <>
                <div className="border-t border-[#E5E7EB] dark:border-border mx-4" />
                <button
                  type="button"
                  onClick={() => onNavigate('permissions')}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted dark:hover:bg-muted transition-colors"
                >
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-black dark:text-white">Centro de Gestão</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Privacidade e Dados (LGPD) — card colapsavel */}
        <Card variant="default" className="mb-4 overflow-hidden">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => setLgpdExpanded((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted dark:hover:bg-muted transition-colors"
            >
              <Shield className="w-5 h-5 text-primary" />
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-black dark:text-white">Privacidade e Dados (LGPD)</span>
                {user.lgpdConsentAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Consentimento aceito em {new Date(user.lgpdConsentAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${lgpdExpanded ? 'rotate-180' : ''}`} />
            </button>

            {lgpdExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div className="border-t border-[#E5E7EB] dark:border-border" />

                {/* Seus Direitos - LGPD Art. 18 */}
                <div className="p-3 rounded-xl bg-[#F3F4F6] dark:bg-card">
                  <p className="text-xs font-semibold text-primary mb-2">
                    Seus Direitos (LGPD Art. 18)
                  </p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span><strong className="text-black dark:text-white">Confirmacao de tratamento</strong> — Dados tratados para gestao de qualidade e seguranca do paciente.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span><strong className="text-black dark:text-white">Acesso e portabilidade</strong> — Exporte seus dados a qualquer momento.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span><strong className="text-black dark:text-white">Correcao de dados</strong> — Edite seus dados em "Editar Perfil".</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span><strong className="text-black dark:text-white">Anonimizacao</strong> — Relatos anonimos sem vinculo com sua identidade.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span><strong className="text-black dark:text-white">Eliminacao</strong> — Solicite a remocao dos seus dados abaixo.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span><strong className="text-black dark:text-white">Revogacao do consentimento</strong> — Revogue a qualquer momento.</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={exportingData}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted hover:bg-[#C8E6C9] dark:hover:bg-muted transition-colors text-left"
                >
                  <Download className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-primary">
                      {exportingData ? 'Exportando...' : 'Exportar Meus Dados'}
                    </span>
                    <p className="text-[11px] text-muted-foreground">Acesso e portabilidade (Art. 18, II e V)</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleRequestDeletion}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-[#450A0A]/50 hover:bg-[#FECACA] dark:hover:bg-[#450A0A] transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4 text-destructive dark:text-destructive" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-destructive dark:text-destructive">Solicitar Exclusao de Dados</span>
                    <p className="text-[11px] text-muted-foreground">Eliminacao e revogacao (Art. 18, VI e IX)</p>
                  </div>
                </button>

                {/* Status das solicitacoes LGPD */}
                {lgpdStatus && lgpdStatus.length > 0 && (
                  <div className="pt-3 border-t border-[#E5E7EB] dark:border-border">
                    <p className="text-xs font-semibold text-primary mb-2">
                      Suas Solicitacoes
                    </p>
                    <div className="space-y-2">
                      {lgpdStatus.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-[#F3F4F6] dark:bg-card">
                          <div>
                            <p className="text-xs font-medium text-black dark:text-white">
                              {s.tipo === 'exclusao' ? 'Exclusao de dados' : s.tipo}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            s.status === 'pendente'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                              : s.status === 'concluida' || s.status === 'resolvida'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {s.status === 'pendente' ? 'Em analise'
                              : s.status === 'concluida' || s.status === 'resolvida'
                                ? `Processada${s.resolved_at ? ` em ${new Date(s.resolved_at).toLocaleDateString('pt-BR')}` : ''}`
                                : s.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full justify-start"
          leftIcon={<LogOut className="w-5 h-5" />}
          onClick={handleLogout}
        >
          Sair
        </Button>
      </div>

      {/* Modal de Edição de Perfil */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-black dark:text-white">Editar Perfil</h2>
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted dark:hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Nome"
                  value={editForm.firstName}
                  onChange={(e) => handleEditChange('firstName', e.target.value)}
                />
                <Input
                  label="Sobrenome"
                  value={editForm.lastName}
                  onChange={(e) => handleEditChange('lastName', e.target.value)}
                />
                <Input
                  label="Email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => handleEditChange('email', e.target.value)}
                />
                <Input
                  label="CRM"
                  value={editForm.crm}
                  onChange={(e) => handleEditChange('crm', e.target.value)}
                />
                <Input
                  label="Especialidade"
                  value={editForm.especialidade}
                  onChange={(e) => handleEditChange('especialidade', e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditing(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveProfile}
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Alterar Senha */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-black dark:text-white">Alterar Senha</h2>
                <button
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                  }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted dark:hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Senha Atual"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  placeholder="Digite sua senha atual"
                />
                <Input
                  label="Nova Senha"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  placeholder="Digite a nova senha"
                />
                <Input
                  label="Confirmar Nova Senha"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  placeholder="Confirme a nova senha"
                />

                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleChangePassword}
                >
                  Alterar Senha
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
