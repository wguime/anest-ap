import { useState } from 'react';
import { SectionCard } from '@/design-system';
import { GraduationCap, Flame, AlertTriangle, Users, Bell, UserCheck, ClipboardList, MapPin, FileText } from 'lucide-react';
import { PageHeader } from '../../components';

// Dados do protocolo de Incendio/Abandono
const PROTOCOLO = {
  titulo: 'Incendio / Abandono de Area',
  cor: '#dc2626',
  quando: 'Ao identificar fumaca, fogo, cheiro de gas, explosao ou alarme sonoro',
  quem: 'Colaborador mais proximo -> Brigada -> CGPED',
  alerta: 'Sirene intermitente e comunicacao por radio',
  equipe: 'Brigada de Incendio, Evacuacao, Remocao, SESMT, Seguranca Patrimonial',
  procedimentos: [
    'Comunicar pacientes e iniciar evacuacao pela rota sinalizada',
    'Fechar valvulas de gases e portas',
    'Priorizar evacuacao por cor (vermelho -> verde)',
    'Confirmar no ponto de encontro externo a evacuacao total',
  ],
  pontos: 'Areas externas sinalizadas (zonas seguras)',
  registros: 'Horario de inicio, termino e setor responsavel',
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

export default function EmergenciaIncendioPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Incendio / Abandono" onBack={() => onNavigate('desastres')} />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Header Card */}
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${PROTOCOLO.cor} 0%, ${PROTOCOLO.cor}CC 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Flame className="w-6 h-6" />
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
          <div className="bg-gray-50 dark:bg-muted rounded-xl p-4">
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
