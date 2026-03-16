import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Leaderboard, Badge } from '@/design-system';
import { ChevronLeft, Trophy, Medal, Star } from 'lucide-react';

// Mock data para ranking (será substituído por Firebase)
const MOCK_RANKING = [
  { id: '1', name: 'João Silva', score: 2450, avatar: null, trend: 0, subtitle: 'Anestesiologista' },
  { id: '2', name: 'Maria Santos', score: 2320, avatar: null, trend: 2, subtitle: 'Coordenador' },
  { id: '3', name: 'Pedro Costa', score: 2180, avatar: null, trend: -1, subtitle: 'Anestesiologista' },
  { id: '4', name: 'Ana Oliveira', score: 1950, avatar: null, trend: 1, subtitle: 'Médico Residente R3' },
  { id: '5', name: 'Carlos Lima', score: 1820, avatar: null, trend: 0, subtitle: 'Anestesiologista' },
  { id: '6', name: 'Juliana Mendes', score: 1750, avatar: null, trend: 3, subtitle: 'Médico Residente R2' },
  { id: '7', name: 'Ricardo Ferreira', score: 1680, avatar: null, trend: -2, subtitle: 'Anestesiologista' },
  { id: '8', name: 'Fernanda Rocha', score: 1520, avatar: null, trend: 1, subtitle: 'Médico Residente R3' },
  { id: '9', name: 'Bruno Almeida', score: 1450, avatar: null, trend: 0, subtitle: 'Médico Residente R2' },
  { id: '10', name: 'Camila Dias', score: 1380, avatar: null, trend: -1, subtitle: 'Médico Residente R1' },
];

export default function ROPsRankingPage({ onNavigate, goBack }) {
  const [filter, setFilter] = useState('all');

  // TODO: Substituir por usuário real do contexto
  const currentUserId = '4'; // Simulando usuário logado

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    // TODO: Buscar dados filtrados do Firebase
  };

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#1A2420] border-b border-[#C8E6C9] dark:border-[#2A3F36] shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-[#006837] dark:text-[#2ECC71] hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-[#004225] dark:text-white truncate text-center flex-1 mx-2">
            Ranking ROPs
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}

      {/* Spacer for fixed header */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 sm:px-5">
        {/* Info Banner */}
        <div className="mb-4 p-4 rounded-[16px] bg-gradient-to-br from-yellow-400 to-orange-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-white">
                Ranking dos Campeões
              </h2>
              <p className="text-[13px] text-white/80 mt-0.5">
                Compare sua pontuação com os demais participantes
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-[12px] bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] text-center">
            <Medal className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-[11px] text-[#6B7280] dark:text-[#6B8178]">Sua Posição</p>
            <p className="text-[18px] font-bold text-[#004225] dark:text-[#2ECC71]">4º</p>
          </div>
          <div className="p-3 rounded-[12px] bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] text-center">
            <Star className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] mx-auto mb-1" />
            <p className="text-[11px] text-[#6B7280] dark:text-[#6B8178]">Pontos</p>
            <p className="text-[18px] font-bold text-[#004225] dark:text-[#2ECC71]">1.950</p>
          </div>
          <div className="p-3 rounded-[12px] bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] text-center">
            <Trophy className="w-5 h-5 text-[#006837] dark:text-[#2ECC71] mx-auto mb-1" />
            <p className="text-[11px] text-[#6B7280] dark:text-[#6B8178]">Quizzes</p>
            <p className="text-[18px] font-bold text-[#004225] dark:text-[#2ECC71]">12</p>
          </div>
        </div>

        {/* Leaderboard */}
        <Leaderboard
          entries={MOCK_RANKING}
          currentUserId={currentUserId}
          title="Top 10"
          showPodium={true}
          showTrend={true}
          maxVisible={10}
          filters={['day', 'week', 'month', 'all']}
          defaultFilter={filter}
          onFilterChange={handleFilterChange}
        />

        {/* Info Box */}
        <div className="mt-4 p-4 rounded-[16px] bg-[#E8F5E9] dark:bg-[#243530] border border-[#C8E6C9] dark:border-[#2A3F36]">
          <h3 className="text-[13px] font-bold text-[#004225] dark:text-[#2ECC71] mb-2">
            Como subir no ranking?
          </h3>
          <ul className="space-y-1 text-[12px] text-[#006837] dark:text-[#A3B8B0]">
            <li>• Complete mais quizzes das ROPs</li>
            <li>• Acerte o máximo de questões possível</li>
            <li>• Mantenha consistência nos estudos</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
