 'react';
import { WidgetCard } from '@/design-system';
import { PageHeader } from '../../components';
import { useCardPermissions } from '../../hooks/useCardPermissions';
import { AlertTriangle, ShieldAlert, QrCode, FileText, Mail, Info, ChevronRight, Shield, Lock, CheckCircle, Hospital } from 'lucide-react';

// Card de Canais de Contato
function CanaisContatoCard() {
  const canais = [
    {
      Icon: Mail,
      label: 'E-mail para Denúncias',
      value: 'anestdenuncia@gmail.com',
      sublabel: 'Canal seguro e confidencial',
    },
    {
      Icon: Mail,
      label: 'E-mail para Notificações',
      value: 'anestnotificacao@gmail.com',
      sublabel: 'Incidentes e notificações',
    },
  ];

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          Canais de Atendimento
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Além do formulário online, você pode fazer seu relato por outros canais:
      </p>

      <div className="space-y-2">
        {canais.map((canal, index) => {
          const CanalIcon = canal.Icon;
          return (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                <CanalIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {canal.label}
                </p>
                <p className="text-sm font-medium text-foreground truncate">
                  {canal.value}
                </p>
                {canal.sublabel && (
                  <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    {canal.sublabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          Todos os canais garantem sigilo absoluto e proteção ao denunciante.
        </p>
      </div>
    </div>
  );
}

// Card de Informacoes sobre Sigilo
function InfoSigiloCard() {
  const items = [
    {
      icon: Shield,
      title: 'Sigilo Garantido',
      description: 'Suas informações são protegidas e tratadas com confidencialidade',
    },
    {
      icon: Lock,
      title: 'Proteção LGPD',
      description: 'Em conformidade com a Lei Geral de Proteção de Dados',
    },
    {
      icon: CheckCircle,
      title: 'Sem Retaliação',
      description: 'Política de não retaliação a denunciantes de boa-fé',
    },
  ];

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Segurança e Privacidade
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncidentesPage({ onNavigate }) {
  const { canAccessCard } = useCardPermissions();

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Notificações e Denúncias" onBack={() => onNavigate('gestao')} />

      <div className="px-4 sm:px-5">
        {/* Banner de Seguranca */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-greenMedium to-greenBright dark:from-greenDark dark:to-greenDarkest">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1">
                Ambiente Seguro
              </h2>
              <p className="text-sm text-white/80">
                Este é um canal seguro para relatar incidentes e denúncias.
                Sua identidade pode ser mantida em sigilo.
              </p>
            </div>
          </div>
        </div>

        {/* Grid de Acoes - 2 colunas */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-6 ds-stagger-in">
          {canAccessCard('relatar_notificacao') && (
            <WidgetCard
              icon={<AlertTriangle className="w-6 h-6" />}
              title="Relatar Notificação"
              subtitle="Notifique eventos adversos"
              onClick={() => onNavigate('novoIncidente')}
              variant="interactive"
            />
          )}

          {canAccessCard('fazer_denuncia') && (
            <WidgetCard
              icon={<ShieldAlert className="w-6 h-6" />}
              iconClassName="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive"
              title="Fazer Denúncia"
              subtitle="Canal seguro e confidencial"
              onClick={() => onNavigate('novaDenuncia')}
              variant="interactive"
            />
          )}

          {canAccessCard('meus_relatos') && (
            <WidgetCard
              icon={<FileText className="w-6 h-6" />}
              title="Meus Relatos"
              subtitle="Acompanhe seus registros"
              onClick={() => onNavigate('meusRelatos')}
              variant="interactive"
            />
          )}

          {canAccessCard('notificacao_unimed') && (
            <WidgetCard
              icon={<Hospital className="w-6 h-6" />}
              title="Notificação Unimed"
              subtitle="Sistema Epimed Monitor"
              onClick={() => window.open('https://patientsafety.epimedmonitor.com/Public/PSNotification?CultureCode=pt-BR&TenantId=D0594BFF-3B84-4CD3-9009-927502C9EFEC&NetworkId=049D109C-44A6-4DA3-881B-25C13357BDF3&HospitalId=B813D26F-4DC7-498E-A5B3-37B1C4AB7A98', '_blank')}
              variant="interactive"
            />
          )}

          {canAccessCard('qrcode_generator') && (
            <WidgetCard
              icon={<QrCode className="w-6 h-6" />}
              title="Gerar QR Code"
              subtitle="Acesso rápido ao formulário"
              onClick={() => onNavigate('qrcodeGenerator')}
              variant="interactive"
            />
          )}
        </div>

        {/* Canais de Contato */}
        <div className="mb-6">
          <CanaisContatoCard />
        </div>

        {/* Informacoes sobre Sigilo */}
        <InfoSigiloCard />

        {/* Rodape informativo */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Entre em contato com o Comitê de Ética
          </p>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
            Todos os relatos são tratados com seriedade e confidencialidade
          </p>
        </div>
      </div>
    </div>
  );
}
