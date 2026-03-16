/**
 * FaturamentoPage - Módulo em Construção
 */
import { createPortal } from 'react-dom';
import { BottomNav } from '@/design-system';
import { ChevronLeft, Hammer, AlertTriangle } from 'lucide-react';

export default function FaturamentoPage({ onNavigate, goBack }) {
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
            Faturamento
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Módulo em Desenvolvimento
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Os dados exibidos são ilustrativos. A integração com dados reais está sendo implementada.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <Hammer className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#004225] dark:text-white mb-2">
            Modulo em Construcao
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            O modulo de Faturamento esta em desenvolvimento e estara disponivel em breve.
          </p>
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'BarChart3', active: false, id: 'dashboard' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'dashboard') onNavigate('dashboardExecutivo');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}
