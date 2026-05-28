/**
 * EventosPage - Lista de eventos de faturamento
 */
import { useState } from 'react';
import { Plus, Search, Filter, X } from 'lucide-react';
import { Button } from '@/design-system';
import { PageShell } from '../../components';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';
import { useEventos, useCadastros } from '../../hooks/useFaturamento';
import { EventoCard } from '../../components/faturamento/EventoCard';
import { STATUS_EVENTO } from '../../data/cbhpmData';

function EventosContent({ onNavigate, goBack }) {
  const { eventos, filters, updateFilters, _totais, loading } = useEventos();
  const { convenioOptions, anestesistaOptions } = useCadastros();

  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');

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
    <PageShell
      title="Eventos"
      onBack={goBack}
      contentClassName="py-4 space-y-4"
      actions={
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg transition-colors ${
            showFilters ? 'bg-primary text-white' : 'text-primary'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      }
    >
        {/* Barra de Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary dark:focus:border-primary"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filtros Expandidos */}
        {showFilters && (
          <div className="rounded-[20px] p-4 bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Filtros
              </span>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => updateFilters({ status: 'all', convenio: 'all', anestesista: 'all' })}
                  className="text-xs text-destructive"
                >
                  Limpar ({activeFiltersCount})
                </button>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateFilters({ status: 'all' })}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    filters.status === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-muted dark:bg-muted text-muted-foreground'
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
                        : 'bg-muted dark:bg-muted text-muted-foreground'
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
              <label className="text-xs text-muted-foreground mb-1 block">Convênio</label>
              <select
                value={filters.convenio}
                onChange={(e) => updateFilters({ convenio: e.target.value })}
                className="w-full p-2 bg-card border border-border rounded-lg text-sm text-foreground"
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
              <label className="text-xs text-muted-foreground mb-1 block">Anestesista</label>
              <select
                value={filters.anestesista}
                onChange={(e) => updateFilters({ anestesista: e.target.value })}
                className="w-full p-2 bg-card border border-border rounded-lg text-sm text-foreground"
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
          <span className="text-sm text-muted-foreground">
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
              <div key={i} className="rounded-[20px] p-4 bg-card border border-border animate-pulse">
                <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="flex gap-4">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-3 bg-muted rounded w-20" />
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
            <div className="rounded-[20px] p-8 bg-card border border-border text-center">
              <p className="text-muted-foreground mb-4">Nenhum evento encontrado</p>
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
    </PageShell>
  );
}

export default function EventosPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <EventosContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
