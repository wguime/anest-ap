import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Award, Loader2 } from 'lucide-react';
import { Card, CardContent, Badge } from '@/design-system';
import { useToast } from '@/design-system/components/ui/toast';

/**
 * Pagina publica de verificacao de certificado
 * Acessivel sem autenticacao em /verificar/:uuid
 *
 * Wave 1.7 (LGPD): substitui a leitura client-side direta de Firestore
 * (que expunha userNome completo) por chamada à edge function pública
 * `verify-cert-uuid-public`. Edge devolve apenas iniciais (G.G.G.) +
 * metadados não-PII do curso.
 *
 * Rate limit: 60 req/min/IP server-side. Em 429 mostra toast destructive.
 * Em 200 com `valid: false` (reason='not_found'), trata como cert inexistente.
 */
export default function VerificarCertificadoPage({ certificadoId }) {
  const [certificado, setCertificado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!certificadoId) {
      setError('ID do certificado nao fornecido');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        if (!supabaseUrl) {
          setError('Servico de verificacao indisponivel');
          setLoading(false);
          return;
        }

        const url =
          `${supabaseUrl}/functions/v1/verify-cert-uuid-public` +
          `?uuid=${encodeURIComponent(certificadoId)}`;
        const res = await fetch(url, { method: 'GET' });

        if (res.status === 429) {
          toast({
            title: 'Muitas tentativas',
            description: 'Aguarde um minuto antes de tentar novamente.',
            variant: 'destructive',
          });
          setError('Muitas tentativas de verificacao. Aguarde um minuto.');
          setLoading(false);
          return;
        }

        const body = await res.json().catch(() => null);

        if (!res.ok || !body) {
          setError('Erro ao verificar certificado');
          setLoading(false);
          return;
        }

        if (body.valid === false) {
          setError('Certificado nao encontrado');
          setLoading(false);
          return;
        }

        setCertificado(body);
      } catch (err) {
        console.error('Erro ao verificar certificado:', err);
        setError('Erro ao verificar certificado');
      } finally {
        setLoading(false);
      }
    })();
  }, [certificadoId, toast]);

  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const status = certificado?.status || null;

  const STATUS_CONFIG = {
    valido: {
      icon: <CheckCircle className="w-12 h-12 text-success" />,
      label: 'Certificado Valido',
      badgeVariant: 'success',
      bgClass: 'bg-success/10',
      borderClass: 'border-success/30',
    },
    expirado: {
      icon: <Clock className="w-12 h-12 text-warning" />,
      label: 'Certificado Expirado',
      badgeVariant: 'warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/30',
    },
    revogado: {
      icon: <XCircle className="w-12 h-12 text-destructive" />,
      label: 'Certificado Revogado',
      badgeVariant: 'destructive',
      bgClass: 'bg-destructive/10',
      borderClass: 'border-destructive/30',
    },
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando certificado...</p>
        </div>
      </div>
    );
  }

  if (error || !certificado) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Certificado Nao Encontrado</h1>
            <p className="text-sm text-muted-foreground">
              {error || 'O certificado solicitado nao existe ou foi removido.'}
            </p>
            <p className="text-xs text-muted-foreground">
              ID: {certificadoId ? `${certificadoId.slice(0, 12)}…` : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.valido;
  // signatureVersion>=2 implica que a edge `sign-cert` (Sprint 12+) emitiu
  // o cert; a edge pública garante que o doc existe — não há HMAC client.
  const assinaturaServerSide =
    typeof certificado.signatureVersion === 'number' && certificado.signatureVersion >= 2;

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
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
                {certificado.iniciais || 'A.'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Iniciais protegidas (LGPD). O titular pode confirmar a identidade.
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
                  {assinaturaServerSide ? (
                    <span className="text-success flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Valida
                    </span>
                  ) : (
                    <span className="text-warning flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Legado
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer — ID truncado (LGPD: o id contém userId em texto plano) */}
        <p className="text-center text-[10px] text-muted-foreground">
          ID: {certificadoId ? `${certificadoId.slice(0, 12)}…` : 'N/A'}
        </p>
      </div>
    </div>
  );
}
