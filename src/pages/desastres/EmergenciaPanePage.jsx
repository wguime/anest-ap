import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, Zap, AlertTriangle, Users, Bell, UserCheck, MapPin, FileText } from 'lucide-react';
import { PageHeader } from '../../components';

// Dados do protocolo de Pane Eletrica
const PROTOCOLO = {
  titulo: 'Pane Eletrica / Falha Estrutural',
  cor: '#f59e0b',
  quando: 'Falha de energia ou de sistemas criticos',
  quem: 'Engenharia Clinica -> CGPED e Diretoria',
  alerta: 'Comunicacao interna via radio',
  equipe: 'Engenharia Clinica, CGPED, TI',
  procedimentos: [
    'Ativar geradores e verificar sistemas de gases',
    'Priorizar suporte em areas criticas (UTI, CC, Emergencia)',
    'Confirmar iluminacao de emergencia',
    'Registrar tempos de falha e retorno',
  ],
  pontos: 'Areas criticas com prioridade: UTI, Centro Cirurgico, Emergencia',
  registros: 'Tempo de falha, tempo de retorno, areas afetadas',
};

// Componente de informacao
function InfoItem({ icon: Icon, title, content, color }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color }}>
            {title}
          </h4>
          <p className="text-sm text-foreground leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EmergenciaPanePage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Pane Eletrica" onBack={() => onNavigate('desastres')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Header Card */}
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${PROTOCOLO.cor} 0%, ${PROTOCOLO.cor}CC 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{PROTOCOLO.titulo}</h3>
              <p className="text-sm text-white/90">Protocolo de emergencia</p>
            </div>
          </div>
        </div>

        {/* Grid de informacoes */}
        <div className="grid grid-cols-1 gap-3">
          <InfoItem icon={AlertTriangle} title="Quando Acionar" content={PROTOCOLO.quando} color={PROTOCOLO.cor} />
          <InfoItem icon={UserCheck} title="Quem Aciona" content={PROTOCOLO.quem} color={PROTOCOLO.cor} />
          <InfoItem icon={Bell} title="Sistema de Alerta" content={PROTOCOLO.alerta} color={PROTOCOLO.cor} />
          <InfoItem icon={Users} title="Equipe Envolvida" content={PROTOCOLO.equipe} color={PROTOCOLO.cor} />
        </div>

        {/* Procedimentos */}
        <SectionCard title="Procedimentos">
          <div className="bg-muted rounded-xl p-4">
            <ol className="space-y-3">
              {PROTOCOLO.procedimentos.map((proc, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: PROTOCOLO.cor }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground leading-relaxed pt-0.5">
                    {proc}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </SectionCard>

        {/* Informacoes adicionais */}
        <div className="grid grid-cols-1 gap-3">
          <InfoItem icon={MapPin} title="Pontos de Encontro / Rotas" content={PROTOCOLO.pontos} color={PROTOCOLO.cor} />
          <InfoItem icon={FileText} title="Registros Obrigatorios" content={PROTOCOLO.registros} color={PROTOCOLO.cor} />
        </div>
      </div>

    </div>
  );
}
