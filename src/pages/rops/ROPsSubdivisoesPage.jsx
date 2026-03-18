import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/config/supabase';
import { WidgetCard, Badge } from '@/design-system';
import {
  ChevronLeft,
  Shield,
  MessageSquare,
  Pill,
  Users,
  Sparkles,
  AlertTriangle,
  FileText,
  CheckCircle,
} from 'lucide-react';
import ropsData from '@/data/rops-data';

// Mapeamento de ícones por área
const AREA_ICONS = {
  'cultura-seguranca': Shield,
  'comunicacao': MessageSquare,
  'uso-medicamentos': Pill,
  'vida-profissional': Users,
  'prevencao-infeccoes': Sparkles,
  'avaliacao-riscos': AlertTriangle,
};

// Cores por área
const AREA_COLORS = {
  'cultura-seguranca': { color: '#9C27B0', gradient: 'linear-gradient(135deg, #9C27B0 0%, #673AB7 100%)' },
  'comunicacao': { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  'uso-medicamentos': { color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' },
  'vida-profissional': { color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
  'prevencao-infeccoes': { color: '#EC4899', gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)' },
  'avaliacao-riscos': { color: '#EF4444', gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
};

export default function ROPsSubdivisoesPage({ onNavigate, goBack, areaKey }) {
  const area = ropsData[areaKey];
  const AreaIcon = AREA_ICONS[areaKey] || FileText;
  const areaColors = AREA_COLORS[areaKey] || { color: '#006837', gradient: 'linear-gradient(135deg, #006837 0%, #004225 100%)' };

  const { user } = useUser();
  const [completedRops, setCompletedRops] = useState(new Set());

  useEffect(() => {
    if (!user?.id || !areaKey) return;
    supabase
      .from('rops_quiz_results')
      .select('rop_key')
      .eq('user_id', user.id)
      .eq('area_key', areaKey)
      .then(({ data }) => {
        if (data) {
          setCompletedRops(new Set(data.map(r => r.rop_key)));
        }
      });
  }, [user?.id, areaKey]);

  if (!area) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-foreground text-lg font-bold mb-4">Área não encontrada</p>
        <button
          type="button"
          onClick={goBack}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Voltar
        </button>
      </div>
    );
  }

  const subdivisoes = Object.entries(area.subdivisoes || {});

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
            {area.title}
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 sm:px-5">
        {/* Card de Destaque da Área */}
        <div
          className="mb-4 p-5 rounded-[16px] min-h-[100px] shadow-[0_4px_16px_rgba(0,66,37,0.12)]"
          style={{ background: areaColors.gradient }}
        >
          <div className="flex items-center gap-4 h-full">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AreaIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-[17px] font-bold text-white leading-tight">
                {area.title}
              </h2>
              <p className="text-[13px] text-white/80 mt-1">
                {subdivisoes.length} ROPs disponíveis • Selecione para iniciar
              </p>
            </div>
          </div>
        </div>

        {/* Lista de ROPs - Grid uniforme */}
        <div className="grid grid-cols-1 gap-3">
          {subdivisoes.map(([ropKey, rop], index) => {
            const questionCount = rop.questions?.length || 0;
            const isCompleted = completedRops.has(ropKey);

            return (
              <button
                key={ropKey}
                type="button"
                onClick={() => onNavigate('ropsQuiz', { areaKey, ropKey })}
                className="w-full text-left p-4 rounded-[16px] bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,66,37,0.10)] active:scale-[0.99] transition-all min-h-[88px]"
              >
                <div className="flex items-center gap-4 h-full">
                  {/* Número/Badge */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-base"
                    style={{ background: areaColors.gradient }}
                  >
                    {index + 1}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-semibold text-foreground dark:text-white leading-snug line-clamp-2">
                        {rop.title}
                      </h3>
                      {isCompleted && (
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" badgeStyle="subtle">
                        {questionCount} questões
                      </Badge>
                      {isCompleted && (
                        <Badge variant="success" badgeStyle="subtle">
                          Concluído
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-4 p-4 rounded-[16px] bg-muted border border-border">
          <h3 className="text-[13px] font-bold text-primary mb-2">
            Dica
          </h3>
          <p className="text-[12px] text-primary dark:text-muted-foreground">
            Cada ROP contém 20 questões. Você ganha 10 pontos por resposta correta.
            Após responder, você verá a explicação da resposta correta.
          </p>
        </div>
      </div>
    </div>
  );
}
