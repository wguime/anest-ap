/**
 * DocumentVersions — Modal "Histórico de Versões" usando DS <Modal>.
 * Renderizada apenas quando `open` true (controlled by parent).
 */
import { Modal } from '@/design-system';

function formatDateShort(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

export default function DocumentVersions({ open, onClose, versoes }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Histórico de Versões"
      description={`${versoes.length} versão(ões) registrada(s)`}
      size="md"
    >
      <Modal.Body>
        <div className="space-y-4" data-testid="versions-list">
          {versoes.map((versao) => (
            <div
              key={versao.versao}
              className={`p-4 rounded-xl border ${
                versao.status === 'ativo'
                  ? 'bg-muted border-border dark:border-primary/30'
                  : 'bg-muted border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-foreground">v{versao.versao}</span>
                {versao.status === 'ativo' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/20 text-success dark:bg-primary/20 dark:text-primary">
                    Atual
                  </span>
                )}
                {versao.status === 'arquivado' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                    Arquivado
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-foreground mb-1">
                {versao.descricaoAlteracao}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Motivo: {versao.motivoAlteracao}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider mb-0.5">
                    Criado em
                  </span>
                  <span className="text-foreground">{formatDateShort(versao.createdAt)}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider mb-0.5">Autor</span>
                  <span className="text-foreground">{versao.createdByName}</span>
                </div>
                {versao.aprovadoPor && (
                  <>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider mb-0.5">
                        Aprovado por
                      </span>
                      <span className="text-foreground">{versao.aprovadoPor}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider mb-0.5">
                        Data Aprovação
                      </span>
                      <span className="text-foreground">
                        {formatDateShort(versao.dataAprovacao)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
}
