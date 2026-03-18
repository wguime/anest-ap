import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useComunicados } from '@/contexts/ComunicadosContext';
import { useDocumentsContext } from '@/contexts/DocumentsContext';
import { useUser } from '@/contexts/UserContext';
import {
  Card,
  CardContent,
  Badge,
  Button,
} from '@/design-system';
import { Megaphone, FileText, Target, Pill, ChevronLeft } from 'lucide-react';

// Tabs para filtrar
const TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'comunicados', label: 'Comunicados' },
  { id: 'documentos', label: 'Docs' },
  { id: 'rops', label: 'ROPs' },
];

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function PendenciasPage({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('todos');
  const { user } = useUser();
  const { publicados, loading: loadingCom } = useComunicados();
  const { overdueDocuments, pendingApproval, loading: loadingDocs } = useDocumentsContext();

  // Comunicados nao lidos pelo usuario atual
  const comunicadosNaoLidos = useMemo(() => {
    if (!user || !publicados) return [];
    return publicados
      .filter((c) => {
        const confirmacoes = c.confirmacoes || c.leituras || [];
        return !confirmacoes.some((l) => l.userId === user.uid || l.userId === user.id);
      })
      .map((c) => ({
        id: c.id,
        titulo: c.titulo || c.title || 'Comunicado',
        dias: daysSince(c.createdAt || c.dataPublicacao || c.data),
      }));
  }, [publicados, user]);

  // Documentos pendentes (vencidos + pendentes de aprovacao)
  const documentosPendentes = useMemo(() => {
    const overdue = (overdueDocuments || []).map((d) => ({
      id: d.id,
      titulo: d.titulo || d.title || 'Documento',
      obrigatorio: true,
    }));
    const pending = (pendingApproval || []).map((d) => ({
      id: d.id,
      titulo: d.titulo || d.title || 'Documento',
      obrigatorio: false,
    }));
    // Deduplicate by id
    const seen = new Set();
    return [...overdue, ...pending].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }, [overdueDocuments, pendingApproval]);

  // ROPs — dados reais viriam do AutoavaliacaoContext (nao disponivel aqui)
  const rops = [];

  const showComunicados = activeTab === 'todos' || activeTab === 'comunicados';
  const showDocumentos = activeTab === 'todos' || activeTab === 'documentos';
  const showROPs = activeTab === 'todos' || activeTab === 'rops';

  const stats = {
    comunicados: comunicadosNaoLidos.length,
    atrasadas: (overdueDocuments || []).length,
    pendentes: (pendingApproval || []).length,
    concluidas: 0,
  };

  const totalPendencias = comunicadosNaoLidos.length + documentosPendentes.length + rops.length;

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Minhas Pendências
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espaçador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="bg-card rounded-2xl p-3 text-center shadow-sm dark:border dark:border-border">
            <p className="text-xl font-bold text-[#3B82F6]">{stats.comunicados}</p>
            <p className="text-[10px] text-muted-foreground">Comunicados</p>
          </div>
          <div className="bg-card rounded-2xl p-3 text-center shadow-sm dark:border dark:border-border">
            <p className="text-xl font-bold text-destructive">{stats.atrasadas}</p>
            <p className="text-[10px] text-muted-foreground">Atrasadas</p>
          </div>
          <div className="bg-card rounded-2xl p-3 text-center shadow-sm dark:border dark:border-border">
            <p className="text-xl font-bold text-warning">{stats.pendentes}</p>
            <p className="text-[10px] text-muted-foreground">Pendentes</p>
          </div>
          <div className="bg-card rounded-2xl p-3 text-center shadow-sm dark:border dark:border-border">
            <p className="text-xl font-bold text-success dark:text-primary">{stats.concluidas}</p>
            <p className="text-[10px] text-muted-foreground">Concluídas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white dark:text-foreground'
                  : 'bg-card text-muted-foreground border border-gray-200 dark:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Comunicados Não Lidos */}
        {showComunicados && comunicadosNaoLidos.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Comunicados Não Lidos
            </h3>
            <div className="space-y-3">
              {comunicadosNaoLidos.map((item) => (
                <Card key={item.id} variant="default">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted dark:bg-[#1E8449] flex items-center justify-center shrink-0">
                      <Megaphone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-black dark:text-white truncate">
                        {item.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        há {item.dias} {item.dias === 1 ? 'dia' : 'dias'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onNavigate('comunicados')}>
                      Ver
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Documentos Pendentes */}
        {showDocumentos && documentosPendentes.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Documentos Pendentes
            </h3>
            <div className="space-y-3">
              {documentosPendentes.map((item) => (
                <Card key={item.id} variant="default">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-black dark:text-white truncate">
                        {item.titulo}
                      </p>
                      {item.obrigatorio && (
                        <Badge variant="warning" badgeStyle="subtle" className="mt-1">
                          Vencido
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onNavigate('gestao-documental')}>
                      Ver
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ROPs Não Concluídos */}
        {showROPs && rops.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              ROPs Não Concluídos
            </h3>
            <div className="space-y-3">
              {rops.map((item) => (
                <Card key={item.id} variant="default">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#C8E6C9] dark:bg-[#145A32] flex items-center justify-center shrink-0">
                        {item.titulo.includes('Medicamentos') ? (
                          <Pill className="w-5 h-5 text-primary" />
                        ) : (
                          <Target className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-black dark:text-white">
                          {item.titulo}
                        </p>
                        <Badge
                          variant={item.status === 'atrasado' ? 'destructive' : 'warning'}
                          badgeStyle="subtle"
                          className="mt-1"
                        >
                          {item.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                        </Badge>
                        {/* Progress bar */}
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progresso</span>
                            <span>{item.progresso}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2ECC71] rounded-full transition-all"
                              style={{ width: `${item.progresso}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="default">
                        Completar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalPendencias === 0 && !loadingCom && !loadingDocs && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhuma pendência encontrada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
