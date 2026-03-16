import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Award, Loader2 } from 'lucide-react';
import { Card, CardContent, Badge } from '@/design-system';
import * as educacaoService from '@/services/educacaoService';

/**
 * Pagina publica de verificacao de certificado
 * Acessivel sem autenticacao em /verificar/:uuid
 */
export default function VerificarCertificadoPage({ certificadoId }) {
  const [certificado, setCertificado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assinaturaValida, setAssinaturaValida] = useState(null);

  useEffect(() => {
    if (!certificadoId) {
      setError('ID do certificado nao fornecido');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { certificado: cert, error: fetchError } = await educacaoService.getCertificadoById(certificadoId);
        if (fetchError || !cert) {
          setError(fetchError || 'Certificado nao encontrado');
          setLoading(false);
          return;
        }
        setCertificado(cert);

        // Verificar assinatura HMAC
        const valido = await educacaoService.verificarAssinatura(cert);
        setAssinaturaValida(valido);
      } catch (err) {
        console.error('Erro ao verificar certificado:', err);
        setError('Erro ao verificar certificado');
      } finally {
        setLoading(false);
      }
    })();
  }, [certificadoId]);

  const formatDate = (d) => {
    if (!d) return '-';
    const date = typeof d?.toDate === 'function' ? d.toDate()
      : typeof d?.seconds === 'number' ? new Date(d.seconds * 1000)
      : new Date(d);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getStatus = () => {
    if (!certificado) return null;

    // Check explicit status field
    if (certificado.status === 'revogado') return 'revogado';

    // Check expiration
    if (certificado.validoAte) {
      const validoAte = typeof certificado.validoAte?.toDate === 'function'
        ? certificado.validoAte.toDate()
        : typeof certificado.validoAte?.seconds === 'number'
          ? new Date(certificado.validoAte.seconds * 1000)
          : new Date(certificado.validoAte);

      if (!isNaN(validoAte.getTime()) && validoAte < new Date()) {
        return 'expirado';
      }
    }

    return 'valido';
  };

  const status = getStatus();

  const STATUS_CONFIG = {
    valido: {
      icon: <CheckCircle className="w-12 h-12 text-green-600" />,
      label: 'Certificado Valido',
      badgeVariant: 'success',
      bgClass: 'bg-green-50 dark:bg-green-950/20',
      borderClass: 'border-green-200 dark:border-green-800',
    },
    expirado: {
      icon: <Clock className="w-12 h-12 text-amber-600" />,
      label: 'Certificado Expirado',
      badgeVariant: 'warning',
      bgClass: 'bg-amber-50 dark:bg-amber-950/20',
      borderClass: 'border-amber-200 dark:border-amber-800',
    },
    revogado: {
      icon: <XCircle className="w-12 h-12 text-red-600" />,
      label: 'Certificado Revogado',
      badgeVariant: 'destructive',
      bgClass: 'bg-red-50 dark:bg-red-950/20',
      borderClass: 'border-red-200 dark:border-red-800',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando certificado...</p>
        </div>
      </div>
    );
  }

  if (error || !certificado) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Certificado Nao Encontrado</h1>
            <p className="text-sm text-muted-foreground">
              {error || 'O certificado solicitado nao existe ou foi removido.'}
            </p>
            <p className="text-xs text-muted-foreground">
              ID: {certificadoId || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.valido;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <Award className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Verificacao de Certificado</h1>
          <p className="text-xs text-muted-foreground">ANEST - Servico de Anestesiologia</p>
        </div>

        {/* Status Card */}
        <Card className={`${config.bgClass} ${config.borderClass} border`}>
          <CardContent className="p-6 text-center space-y-3">
            {config.icon}
            <Badge variant={config.badgeVariant} className="text-sm px-3 py-1">
              {config.label}
            </Badge>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Titular</p>
              <p className="text-base font-semibold text-foreground mt-0.5">
                {certificado.userNome || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Curso</p>
              <p className="text-base font-semibold text-foreground mt-0.5">
                {certificado.cursoTitulo || 'N/A'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Carga Horaria</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {certificado.cargaHoraria || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Data de Emissao</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {formatDate(certificado.dataEmissao)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Valido Ate</p>
                <p className="text-sm font-medium text-foreground mt-0.5">
                  {certificado.validoAte ? formatDate(certificado.validoAte) : 'Sem expiracao'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Assinatura Digital</p>
                <p className="text-sm font-medium mt-0.5">
                  {assinaturaValida === null ? (
                    <span className="text-muted-foreground">Verificando...</span>
                  ) : assinaturaValida ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Valida
                    </span>
                  ) : (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Invalida
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground">
          ID: {certificado.id}
        </p>
      </div>
    </div>
  );
}
