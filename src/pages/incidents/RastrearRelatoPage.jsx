import { useState } from 'react';
import { Search, Clock, CheckCircle, AlertCircle, FileSearch, MessageSquare, Lock, Info, ChevronRight, RefreshCw } from 'lucide-react';
import { STATUS_CONFIG, INCIDENT_TYPES, formatDate, formatDateTime, formatRelativeTime } from '@/data/incidentesConfig';
import { useIncidents } from '@/contexts/IncidentsContext';
import { PageHeader } from '../../components';

/**
 * Parses historicoStatus which may come as JSON array (from RPC ->) or as object (from mock).
 * Returns an array of status history items.
 */
function parseHistoricoStatus(hs, fallbackDate, fallbackLabel) {
  if (!hs) return [{ status: 'pending', data: fallbackDate, observacao: fallbackLabel }];
  if (typeof hs === 'string') {
    try { return JSON.parse(hs); } catch { return [{ status: 'pending', data: fallbackDate, observacao: fallbackLabel }]; }
  }
  return hs;
}

/**
 * Constrói objeto de resultado para exibição a partir de um incidente.
 * Handles both mock data (nested fields) and RPC data (flat fields).
 */
function buildResultFromIncidente(inc) {
  return {
    tipo: 'incidente',
    protocolo: inc.protocolo,
    trackingCode: inc.trackingCode,
    status: inc.status,
    createdAt: inc.createdAt,
    ultimaAtualizacao: inc.ultimaAtualizacao || inc.gestaoInterna?.ultimaAtualizacao || inc.createdAt,
    resumo: (inc.incidenteResumo || inc.incidente?.descricao || '').substring(0, 150)
      || `Incidente: ${INCIDENT_TYPES[inc.incidenteTipo || inc.incidente?.tipo]?.label || 'Não especificado'}`,
    historicoStatus: parseHistoricoStatus(
      inc.historicoStatus || inc.gestaoInterna?.historicoStatus,
      inc.createdAt,
      'Relato recebido'
    ),
    feedbackAoRelator: inc.feedbackAoRelator || inc.gestaoInterna?.feedbackAoRelator || null,
  };
}

/**
 * Constrói objeto de resultado para exibição a partir de uma denúncia.
 * Handles both mock data (nested fields) and RPC data (flat fields).
 */
function buildResultFromDenuncia(den) {
  return {
    tipo: 'denuncia',
    protocolo: den.protocolo,
    trackingCode: den.trackingCode,
    status: den.status,
    createdAt: den.createdAt,
    ultimaAtualizacao: den.ultimaAtualizacao || den.gestaoInterna?.ultimaAtualizacao || den.createdAt,
    resumo: den.denunciaTitulo || den.denuncia?.titulo || (den.denuncia?.descricao || '').substring(0, 150) || 'Denúncia registrada',
    historicoStatus: parseHistoricoStatus(
      den.historicoStatus || den.gestaoInterna?.historicoStatus,
      den.createdAt,
      'Denúncia recebida'
    ),
    feedbackAoRelator: den.feedbackAoRelator || den.gestaoInterna?.feedbackAoRelator || null,
  };
}

// Componente de Timeline
function StatusTimeline({ historico }) {
  return (
    <div className="space-y-4">
      {historico.map((item, index) => {
        const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
        const isLast = index === historico.length - 1;

        return (
          <div key={index} className="relative flex gap-4">
            {/* Linha vertical */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border dark:bg-card-elevated" />
            )}

            {/* Dot */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10"
              style={{ backgroundColor: config.bgColor }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-sm font-medium"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(item.data)}
                </span>
              </div>
              {item.observacao && (
                <p className="text-sm text-muted-foreground">
                  {item.observacao}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Componente de Status Badge
function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
    >
      {status === 'resolved' || status === 'closed' ? (
        <CheckCircle className="w-3.5 h-3.5" />
      ) : (
        <Clock className="w-3.5 h-3.5" />
      )}
      {config.label}
    </span>
  );
}

// Componente de Resultado da Busca
function ResultadoBusca({ relato, onVoltar }) {
  const config = STATUS_CONFIG[relato.status] || STATUS_CONFIG.pending;

  return (
    <div className="space-y-5">
      {/* Card principal */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {relato.tipo === 'incidente' ? 'Incidente' : 'Denúncia'}
            </p>
            <p className="font-mono text-sm font-semibold text-foreground">
              {relato.protocolo}
            </p>
          </div>
          <StatusBadge status={relato.status} />
        </div>

        {/* Resumo */}
        <p className="text-sm text-muted-foreground mb-4">
          {relato.resumo}
        </p>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Data do Relato</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(relato.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Última Atualização</p>
            <p className="text-sm font-medium text-foreground">
              {formatRelativeTime(relato.ultimaAtualizacao)}
            </p>
          </div>
        </div>

        {/* Status description */}
        <div
          className="p-3 rounded-xl"
          style={{ backgroundColor: `${config.color}10` }}
        >
          <p className="text-xs" style={{ color: config.color }}>
            {config.description}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Histórico de Status
        </h3>
        <StatusTimeline historico={relato.historicoStatus} />
      </div>

      {/* Feedback do Comitê */}
      {relato.feedbackAoRelator && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Mensagem da Equipe
          </h3>
          <div className="p-4 rounded-xl bg-background border border-border">
            <p className="text-sm text-foreground">
              {relato.feedbackAoRelator}
            </p>
          </div>
        </div>
      )}

      {/* Botão voltar */}
      <button
        type="button"
        onClick={onVoltar}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-muted transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Consultar outro código
      </button>
    </div>
  );
}

// Componente principal
export default function RastrearRelatoPage({ onNavigate }) {
  const { fetchByTrackingCode } = useIncidents();
  const [trackingCode, setTrackingCode] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!trackingCode.trim()) {
      setError('Por favor, digite o código de rastreio');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const code = trackingCode.trim().toUpperCase();
      const found = await fetchByTrackingCode(code);

      if (found) {
        // Determine type and build result accordingly
        if (found.tipo === 'denuncia') {
          setResultado(buildResultFromDenuncia(found));
        } else {
          setResultado(buildResultFromIncidente(found));
        }
      } else {
        setError('Código de rastreio não encontrado. Verifique se digitou corretamente.');
      }
    } catch (err) {
      console.error('[RastrearRelato] Erro na busca:', err);
      setError('Erro ao buscar o código de rastreio. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoltar = () => {
    setResultado(null);
    setTrackingCode('');
    setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Rastrear Relato" onBack={() => onNavigate('incidentes')} />

      <div className="px-4 sm:px-5">

        {resultado ? (
          <ResultadoBusca relato={resultado} onVoltar={handleVoltar} />
        ) : (
          <>
            {/* Banner informativo */}
            <div className="mb-5 p-4 rounded-xl bg-info/10 dark:bg-info/20 border border-info/30">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-info">
                    Consulta Segura
                  </p>
                  <p className="text-xs text-info mt-1">
                    Use o código de rastreio recebido ao enviar seu relato para acompanhar o andamento de forma anônima e segura.
                  </p>
                </div>
              </div>
            </div>

            {/* Formulário de busca */}
            <div className="bg-card rounded-2xl p-5 border border-border">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-background flex items-center justify-center mb-4">
                  <FileSearch className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-1">
                  Consultar Status do Relato
                </h2>
                <p className="text-sm text-muted-foreground">
                  Digite o código de rastreio para verificar o andamento
                </p>
              </div>

              {/* Input de código */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Código de Rastreio
                  </label>
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    placeholder="Ex: ANEST-2026-ABC123"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card dark:bg-background text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary focus:border-transparent transition-all font-mono text-center text-lg tracking-wider"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 dark:bg-destructive/20 border border-destructive/30">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <p className="text-sm text-destructive">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={isLoading}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium transition-colors
                    ${isLoading
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-white dark:text-primary-foreground hover:bg-primary-hover'
                    }
                  `}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Consultar Status
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Dica */}
            <div className="mt-5 p-4 rounded-xl bg-muted">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Onde encontro o código?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O código de rastreio é exibido na tela de confirmação após enviar um relato anônimo ou confidencial. Ele tem o formato ANEST-XXXX-XXXXXX.
                  </p>
                </div>
              </div>
            </div>

            {/* Dica de formato */}
            <div className="mt-4 p-4 rounded-xl bg-warning/10 dark:bg-warning/20 border border-warning/30">
              <p className="text-xs font-medium text-warning mb-2">
                Formato do código de rastreio:
              </p>
              <p className="text-xs font-mono text-warning">
                ANEST-XXXX-XXXXXX
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
