import { useState, useMemo } from 'react';
import { ComunicadosCard, WidgetCard, Skeleton, Button } from '@/design-system';
import { PageHeader } from '@/components';
import { GraduationCap, FolderOpen, BookOpen, Users, Upload } from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';
import { useDocuments } from '@/hooks/useDocuments';
import { useUser } from '@/contexts/UserContext';
import { isAdministrator } from '@/design-system/components/anest/admin-only';
import { isBulkImportEnabled } from '@/utils/featureFlags';

export default function GestaoDocumentalPage({ onNavigate, _goBack }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  // Document counts from SSOT
  const { counts, overdueDocuments, pendingApproval, isLoading } = useDocuments();

  // Sprint 5 / O2-4: Botão "Importar em massa" só para admin com flag ON.
  const { currentUser } = useUser() || {};
  const showBulkImport = isBulkImportEnabled() && isAdministrator(currentUser);

  const bibliotecaItems = useMemo(() => [
    `${counts.biblioteca || 0} documentos ativos`,
    overdueDocuments.length > 0
      ? `${overdueDocuments.length} revisao(oes) vencida(s)`
      : 'Revisoes em dia',
  ], [counts.biblioteca, overdueDocuments.length]);

  const comitesItems = useMemo(() => [
    `${counts.comites || 0} documentos ativos`,
    pendingApproval.length > 0
      ? `${pendingApproval.length} pendente(s) de aprovacao`
      : 'Sem pendencias',
  ], [counts.comites, pendingApproval.length]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Gestão Documental"
        onBack={() => onNavigate('gestao')}
      />

      <div className="px-4 sm:px-5 pt-4">
        {/* Card: Biblioteca de Documentos */}
        <div className="mb-3">
          {isLoading ? (
            <Skeleton variant="card" height={140} aria-label="Carregando biblioteca…" />
          ) : (
            <ComunicadosCard
              label="DOCUMENTOS"
              title="Biblioteca de Documentos"
              badgeText="Acessar"
              items={bibliotecaItems}
              onViewAll={() => onNavigate('biblioteca')}
            />
          )}
        </div>

        {/* Card: Comitês Institucionais */}
        <div className="mb-4">
          {isLoading ? (
            <Skeleton variant="card" height={140} aria-label="Carregando comitês…" />
          ) : (
            <ComunicadosCard
              label="GOVERNANÇA"
              title="Comitês Institucionais"
              badgeText="Acessar"
              items={comitesItems}
              onViewAll={() => onNavigate('comites')}
            />
          )}
        </div>

        {/* Sprint 5 / O2-4 — Importação em massa (admin only) */}
        {showBulkImport && (
          <div className="mb-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onNavigate('bulkImport')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar documentos em massa
            </Button>
          </div>
        )}

        {/* Info Footer */}
        <div
          className={cn(
            "mt-6 p-4 rounded-xl",
            "bg-muted",
            "border border-border"
          )}
        >
          <p className="text-xs text-muted-foreground">
            <strong>Sobre a Gestão Documental:</strong> Acesse a Biblioteca de Documentos
            para protocolos, políticas, formulários e manuais. Os Comitês Institucionais
            contêm documentos de governança, atas de reuniões e regulamentos internos.
          </p>
        </div>
      </div>

    </div>
  );
}
