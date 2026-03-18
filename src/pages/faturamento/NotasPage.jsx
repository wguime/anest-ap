/**
 * NotasPage - Lista de notas fiscais
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Plus,
  Search,
  Filter,
  FileText,
  Calendar,
  Building2,
  DollarSign,
} from 'lucide-react';
import { Badge, Button, BottomNav } from '@/design-system';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';
import { useNotas, useCadastros } from '../../hooks/useFaturamento';
import { formatarMoeda, STATUS_NOTA } from '../../data/cbhpmData';

function NotasContent({ onNavigate, goBack }) {
  const { notas, totais, filters, updateFilters, loading } = useNotas();
  const { convenioOptions } = useCadastros();

  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
            Notas Fiscais
          </h1>
          <div className="min-w-[70px] flex justify-end">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-primary text-white' : 'text-primary'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('pt-BR');
  };

  const filteredNotas = notas.filter(n =>
    n.number?.toLowerCase().includes(searchText.toLowerCase()) ||
    n.healthInsuranceName?.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Totais */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[20px] p-3 bg-card border border-border">
            <p className="text-xs text-muted-foreground">Total Emitido</p>
            <p className="text-lg font-bold text-foreground">
              {formatarMoeda(totais.valor)}
            </p>
            <p className="text-xs text-muted-foreground">{totais.total} notas</p>
          </div>
          <div className="rounded-[20px] p-3 bg-card border border-border">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-warning">
              {formatarMoeda(totais.valorPendente)}
            </p>
            <p className="text-xs text-muted-foreground">{totais.pendente} notas</p>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar notas..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder-[#6B7280] focus:outline-none focus:border-primary dark:focus:border-primary"
          />
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="rounded-[20px] p-4 bg-card border border-border space-y-3">
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
                  Todas
                </button>
                {Object.values(STATUS_NOTA).map((status) => (
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
          </div>
        )}

        {/* Resumo e Botão */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredNotas.length} nota{filteredNotas.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="default"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => onNavigate('faturamentoNovaNota')}
          >
            Nova Nota
          </Button>
        </div>

        {/* Lista de Notas */}
        <div className="space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="rounded-[20px] p-4 bg-card border border-border animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              </div>
            ))
          ) : filteredNotas.length > 0 ? (
            filteredNotas.map((nota) => {
              const statusInfo = STATUS_NOTA[nota.status?.toUpperCase()] || STATUS_NOTA.EMITIDA;

              return (
                <button
                  key={nota.id}
                  type="button"
                  onClick={() => onNavigate('faturamentoNotaDetalhe', { id: nota.id })}
                  className="w-full text-left rounded-[20px] bg-card border border-border shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-none hover:shadow-[0_4px_16px_rgba(0,66,37,0.1)] hover:border-primary dark:hover:border-primary transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-lg">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            Nota {nota.number}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {nota.healthInsuranceName}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="default"
                        badgeStyle="solid"
                        style={{ backgroundColor: statusInfo.cor, color: 'white' }}
                      >
                        {statusInfo.descricao}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(nota.issueDate)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span>{nota.events?.length || 0} eventos</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <DollarSign className="w-4 h-4 text-success" />
                        <span className="font-bold text-primary">
                          {formatarMoeda(nota.totalValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[20px] p-8 bg-card border border-border text-center">
              <p className="text-muted-foreground mb-4">Nenhuma nota encontrada</p>
              <Button
                variant="default"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => onNavigate('faturamentoNovaNota')}
              >
                Criar Nova Nota
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

export default function NotasPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <NotasContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
