/**
 * EventosPage - Lista de eventos de faturamento
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Plus,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { Button, BottomNav } from '@/design-system';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';
import { useEventos, useCadastros } from '../../hooks/useFaturamento';
import { EventoCard } from '../../components/faturamento/EventoCard';
import { STATUS_EVENTO } from '../../data/cbhpmData';

function EventosContent({ onNavigate, goBack }) {
  const { eventos, filters, updateFilters, totais, loading } = useEventos();
  const { convenioOptions, anestesistaOptions } = useCadastros();

  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');

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
            Eventos
          </h1>
          <div className="min-w-[70px] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-[#004225] text-white' : 'text-[#006837] dark:text-[#2ECC71]'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  const handleSearch = (value) => {
    setSearchText(value);
    updateFilters({ search: value });
  };

  const activeFiltersCount = [
    filters.status !== 'all',
    filters.convenio !== 'all',
    filters.anestesista !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#F0FFF4] dark:bg-[#111916] pb-24">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Barra de Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-xl text-[#004225] dark:text-white placeholder-[#6B7280] focus:outline-none focus:border-[#004225] dark:focus:border-[#2ECC71]"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#004225]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filtros Expandidos */}
        {showFilters && (
          <div className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#004225] dark:text-white">
                Filtros
              </span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => updateFilters({ status: 'all', convenio: 'all', anestesista: 'all' })}
                  className="text-xs text-[#DC2626]"
                >
                  Limpar ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateFilters({ status: 'all' })}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    filters.status === 'all'
                      ? 'bg-[#004225] text-white'
                      : 'bg-[#E8F5E9] dark:bg-[#2A3F36] text-[#6B7280]'
                  }`}
                >
                  Todos
                </button>
                {Object.values(STATUS_EVENTO).map((status) => (
                  <button
                    key={status.codigo}
                    type="button"
                    onClick={() => updateFilters({ status: status.codigo })}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      filters.status === status.codigo
                        ? 'text-white'
                        : 'bg-[#E8F5E9] dark:bg-[#2A3F36] text-[#6B7280]'
                    }`}
                    style={
                      filters.status === status.codigo
                        ? { backgroundColor: status.cor }
                        : {}
                    }
                  >
                    {status.descricao}
                  </button>
                ))}
              </div>
            </div>

            {/* Convênio */}
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Convênio</label>
              <select
                value={filters.convenio}
                onChange={(e) => updateFilters({ convenio: e.target.value })}
                className="w-full p-2 bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-lg text-sm text-[#004225] dark:text-white"
              >
                {convenioOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Anestesista */}
            <div>
              <label className="text-xs text-[#6B7280] mb-1 block">Anestesista</label>
              <select
                value={filters.anestesista}
                onChange={(e) => updateFilters({ anestesista: e.target.value })}
                className="w-full p-2 bg-white dark:bg-[#1A2420] border border-[#C8E6C9] dark:border-[#2A3F36] rounded-lg text-sm text-[#004225] dark:text-white"
              >
                {anestesistaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Resumo */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#6B7280]">
            {eventos.length} evento{eventos.length !== 1 ? 's' : ''} encontrado{eventos.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="default"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigate('faturamentoNovoEvento')}
          >
            Novo
          </Button>
        </div>

        {/* Lista de Eventos */}
        <div className="space-y-3">
          {loading ? (
            // Loading skeleton
            [...Array(3)].map((_, i) => (
              <div key={i} className="rounded-[20px] p-4 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                <div className="flex gap-4">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                </div>
              </div>
            ))
          ) : eventos.length > 0 ? (
            eventos.map((evento) => (
              <EventoCard
                key={evento.id}
                evento={evento}
                onClick={() => onNavigate('faturamentoEventoDetalhe', { id: evento.id })}
              />
            ))
          ) : (
            <div className="rounded-[20px] p-8 bg-white dark:bg-[#1A2420] border border-[#A5D6A7] dark:border-[#2A3F36] text-center">
              <p className="text-[#6B7280] mb-4">Nenhum evento encontrado</p>
              <Button
                variant="default"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => onNavigate('faturamentoNovoEvento')}
              >
                Criar Primeiro Evento
              </Button>
            </div>
          )}
        </div>
      </div>

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}

export default function EventosPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <EventosContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
