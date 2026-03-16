import { useState } from 'react';
import { createPortal } from 'react-dom';
import { WidgetCard } from '@/design-system';
import { useCardPermissions } from '../../hooks/useCardPermissions';
import {
  AlertTriangle,
  ShieldAlert,
  QrCode,
  FileText,
  Mail,
  Info,
  ChevronRight,
  ChevronLeft,
  Shield,
  Lock,
  CheckCircle,
  Hospital,
} from 'lucide-react';

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
    <div className="p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#1A2F23] border border-[#C8E6C9] dark:border-[#2D4A3E]">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
        <span className="text-sm font-semibold text-[#006837] dark:text-[#2ECC71]">
          Canais de Atendimento
        </span>
      </div>

      <p className="text-xs text-[#6B7280] dark:text-[#6B8178] mb-3">
        Além do formulário online, você pode fazer seu relato por outros canais:
      </p>

      <div className="space-y-2">
        {canais.map((canal, index) => {
          const CanalIcon = canal.Icon;
          return (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-lg bg-white/60 dark:bg-[#243530]/60"
            >
              <div className="w-8 h-8 rounded-lg bg-[#006837]/10 dark:bg-[#2ECC71]/20 flex items-center justify-center flex-shrink-0">
                <CanalIcon className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
                  {canal.label}
                </p>
                <p className="text-sm font-medium text-[#111827] dark:text-white truncate">
                  {canal.value}
                </p>
                {canal.sublabel && (
                  <p className="text-[10px] text-[#9CA3AF] dark:text-[#4B5E55]">
                    {canal.sublabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-[#C8E6C9] dark:border-[#2D4A3E]">
        <p className="text-[10px] text-[#6B7280] dark:text-[#6B8178] text-center">
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
    <div className="p-4 rounded-xl bg-white dark:bg-[#1A2F23] border border-[#E5E7EB] dark:border-[#2D4A3E]">
      <h3 className="text-sm font-semibold text-[#111827] dark:text-white mb-3">
        Segurança e Privacidade
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] dark:bg-[#243530] flex items-center justify-center flex-shrink-0">
              <item.icon className="w-4 h-4 text-[#006837] dark:text-[#2ECC71]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#111827] dark:text-white">
                {item.title}
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
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
  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('gestao')}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Gestão de Incidentes
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Banner de Seguranca */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#006837] to-[#27AE60] dark:from-[#1A4D2E] dark:to-[#2D5A3E]">
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-6">
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
              iconClassName="bg-[#FEE2E2] text-[#EF4444] dark:bg-[#3A2020] dark:text-[#F87171]"
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
          <p className="text-xs text-[#6B7280] dark:text-[#6B8178]">
            Dúvidas? Entre em contato com o Comitê de Ética
          </p>
          <p className="text-xs text-[#9CA3AF] dark:text-[#4B5E55] mt-1">
            Todos os relatos são tratados com seriedade e confidencialidade
          </p>
        </div>
      </div>
    </div>
  );
}
