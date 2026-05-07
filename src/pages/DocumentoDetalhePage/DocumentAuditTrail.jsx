/**
 * DocumentAuditTrail — wrapper para o painel da aba "Histórico/Audit Trail".
 * AuditTrailViewer já exibe ações destrutivas só pra admin via prop isAdmin.
 */
import AuditTrailViewer from '@/components/documents/AuditTrailViewer';

export default function DocumentAuditTrail({ documentoId, isAdmin }) {
  return (
    <div role="tabpanel" id="tab-panel-historico" aria-labelledby="tab-historico">
      <AuditTrailViewer documentoId={documentoId} isAdmin={isAdmin} />
    </div>
  );
}
