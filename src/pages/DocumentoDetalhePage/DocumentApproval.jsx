/**
 * DocumentApproval — botões de admin (Editar / Nova Versão / Histórico / Arquivar)
 * + tabs de navegação (Documento / Distribuição / Histórico).
 *
 * Atalho de leitura: a botoeira é admin-only (mutações);
 * a aba Histórico é visível para todos (read-only via AuditTrailViewer).
 */
import { Edit, Plus, History, Archive } from 'lucide-react';

export default function DocumentApproval({
  isAdmin,
  activeTab,
  onTabChange,
  onEdit,
  onNewVersion,
  onShowVersions,
  onArchive,
}) {
  return (
    <>
      {/* Botoes de Administracao - admin-only */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-border dark:hover:bg-muted transition-colors"
          >
            <Edit className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Editar</span>
          </button>
          <button
            onClick={onNewVersion}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-border dark:hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Nova Versao</span>
          </button>
          <button
            onClick={onShowVersions}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-border dark:hover:bg-muted transition-colors"
          >
            <History className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Historico</span>
          </button>
          <button
            onClick={onArchive}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-destructive/10 dark:bg-destructive/20 hover:bg-destructive/20 dark:hover:bg-destructive/30 transition-colors"
          >
            <Archive className="w-4 h-4 text-destructive dark:text-destructive" />
            <span className="text-sm font-medium text-destructive dark:text-destructive">
              Arquivar
            </span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-2 mb-4 overflow-x-auto"
        role="tablist"
        aria-label="Seções do documento"
      >
        {[
          { id: 'documento', label: 'Documento' },
          ...(isAdmin ? [{ id: 'distribuicao', label: 'Distribuicao' }] : []),
          { id: 'historico', label: isAdmin ? 'Audit Trail' : 'Historico' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? 'bg-primary text-white dark:bg-primary dark:text-primary-foreground'
                : 'bg-muted text-primary hover:bg-border dark:hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}
