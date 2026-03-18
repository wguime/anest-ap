import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SectionCard, BottomNav } from '@/design-system';
import {
  GraduationCap,
  ChevronLeft,
  Users,
  AlertTriangle,
  Bell,
  UserCheck,
  MapPin,
  FileText,
} from 'lucide-react';

// Dados do protocolo de Multiplas Vitimas
const PROTOCOLO = {
  titulo: 'Multiplas Vitimas / Desastre Externo',
  cor: '#dc2626',
  quando: 'Recebimento de alerta externo (SAMU, Defesa Civil)',
  quem: 'Coordenador Medico de Emergencia / Enfermagem -> CGPED',
  alerta: 'Comunicacao via radio e ativacao do Gabinete de Crise',
  equipe: 'Coordenação Geral (Diretor Técnico), Coordenação Assistencial (Enfermagem, medicos, anestesistas), Coordenação Estrutural (Engenharia, SESMT, seguranca), Coordenação de Comunicação (Diretoria, Marketing)',
  procedimentos: [
    'Montar area de triagem e isolamento',
    'Ativar hospital de base (apoio) e definir fluxo de atendimento',
    'Pacientes Azul/Verde -> Unimed Personal',
    'Registrar horarios, leitos e transferencias',
  ],
  pontos: 'Entrada prioritaria de ambulancias; acesso livre ao CC e UTI',
  registros: 'Gabinete de Crise documenta todas as acoes',
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

export default function EmergenciaVitimasPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('desastres')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Multiplas Vitimas
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Header Card */}
        <div
          className="rounded-2xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${PROTOCOLO.cor} 0%, ${PROTOCOLO.cor}CC 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Users className="w-6 h-6" />
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

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: (
              <GraduationCap
                className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground"
                fill="none"
              />
            ),
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
