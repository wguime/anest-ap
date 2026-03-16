import { Download, RefreshCw } from 'lucide-react';
import { Button, Badge, Spinner } from '@/design-system';
import { formatData, CREDIT_TYPE_LABELS } from '../data/educacaoUtils';

/**
 * Calcula status de validade do certificado
 * @returns {{ status: 'valido'|'expirando'|'expirado', diasRestantes: number|null }}
 */
function getValidadeStatus(certificado) {
  if (!certificado.validoAte) return { status: 'valido', diasRestantes: null };

  const agora = new Date();
  const validoAte = typeof certificado.validoAte?.toDate === 'function'
    ? certificado.validoAte.toDate()
    : typeof certificado.validoAte?.seconds === 'number'
      ? new Date(certificado.validoAte.seconds * 1000)
      : new Date(certificado.validoAte);

  if (isNaN(validoAte.getTime())) return { status: 'valido', diasRestantes: null };

  const diffMs = validoAte.getTime() - agora.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes <= 0) return { status: 'expirado', diasRestantes };
  if (diasRestantes <= 90) return { status: 'expirando', diasRestantes };
  return { status: 'valido', diasRestantes };
}

const VALIDADE_CONFIG = {
  valido: { variant: 'success', label: 'Válido' },
  expirando: { variant: 'warning', label: 'Expira em breve' },
  expirado: { variant: 'destructive', label: 'Expirado' },
};

export function CertificadoItem({ certificado, onDownload, onRenovar }) {
  const creditLabel = CREDIT_TYPE_LABELS[certificado.tipoCreditoEducacao];
  const { status, diasRestantes } = getValidadeStatus(certificado);
  const config = VALIDADE_CONFIG[status];

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {certificado.cursoTitulo}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {certificado.cargaHoraria}
          </span>
          {certificado.creditosHoras != null && (
            <span className="text-xs text-muted-foreground">
              {certificado.creditosHoras}h crédito
            </span>
          )}
          {creditLabel && (
            <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] px-1.5 py-0">
              {creditLabel}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatData(certificado.dataConclusao)}
          </span>
          {/* Indicador de validade */}
          <Badge variant={config.variant} badgeStyle="subtle" className="text-[10px] px-1.5 py-0">
            {status === 'expirando' && diasRestantes != null
              ? `${diasRestantes}d restantes`
              : config.label
            }
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {status === 'expirado' && onRenovar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRenovar?.(certificado)}
            aria-label="Renovar certificado"
            title="Renovar certificado"
          >
            <RefreshCw className="w-4 h-4 text-destructive" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onDownload?.(certificado)}
          aria-label="Baixar certificado"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function CertificadoPendenteItem({ certificado, onEmitir, emitindo }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {certificado.cursoTitulo}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {certificado.cargaHoraria}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatData(certificado.dataConclusao)}
          </span>
        </div>
      </div>
      <button
        onClick={() => onEmitir?.(certificado)}
        disabled={emitindo}
        className="shrink-0 text-xs font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
      >
        {emitindo ? (
          <>
            <Spinner size="xs" />
            Emitindo...
          </>
        ) : (
          'Emitir'
        )}
      </button>
    </div>
  );
}
