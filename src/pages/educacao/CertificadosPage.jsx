import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCcw } from 'lucide-react';
import { Card, CardContent, Alert, Avatar, Button, EmptyState, Spinner, useToast } from '@/design-system';
import { CertificadoItem, CertificadoPendenteItem } from './components/CertificadoItem';

import { useUser } from '@/contexts/UserContext';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { PageHeader } from '../../components';
// Wave 1.9 cleanup: downloadCertificate + uploadCertificatePDF (Firebase Storage
// legacy) foram removidos de certificateGenerator. Upload acontece dentro de
// emitirCertificado (Supabase obrigatório). Download usa apenas signed URL.
import { getUserId } from '@/utils/userIdContext';
import { getCertificadosComAlertaExpiracao } from '@/utils/certificadoExpiracao';

export default function CertificadosPage({ onNavigate, goBack }) {
  const { toast } = useToast();
  const { user } = useUser();
  const userId = getUserId(user);
  const { cursos, _useMock } = useEducacaoData();

  const userName = user?.displayName || 'Usuario';
  const userEmail = user?.email || 'email@exemplo.com';
  const nameParts = userName.trim().split(/\s+/);
  const userInitials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : userName.substring(0, 2).toUpperCase();

  const [certificados, setCertificados] = useState([]);
  const [progressos, setProgressos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emitindo, setEmitindo] = useState(null); // cursoId being emitted

  // Fetch certificados e progressos do Firestore
  const fetchData = useCallback(async () => {
    if (!userId || userId === 'system') return;
    setLoading(true);
    try {
      const [certResult, progResult] = await Promise.all([
        educacaoService.getCertificados(userId),
        educacaoService.getProgressoUsuario(userId),
      ]);
      setCertificados(certResult.certificados || []);
      setProgressos(progResult.progressos || []);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao buscar dados de certificados:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cursos concluidos sem certificado emitido
  const certificadosPendentes = (() => {
    const cursosConcluidosIds = progressos
      .filter(p => p.status === 'concluido' || p.status === 'aprovado')
      .map(p => p.cursoId || p.id);

    const certificadosEmitidosIds = certificados
      .filter(c => c.emitido)
      .map(c => c.cursoId);

    return (cursos || [])
      .filter(c => cursosConcluidosIds.includes(c.id) && !certificadosEmitidosIds.includes(c.id))
      .map(c => {
        const prog = progressos.find(p => (p.cursoId || p.id) === c.id);
        return {
          id: `pending-${c.id}`,
          cursoId: c.id,
          cursoTitulo: c.titulo,
          cargaHoraria: `${Math.ceil((c.duracaoMinutos || 60) / 60)}h`,
          dataConclusao: prog?.dataConclusao,
          tipoCreditoEducacao: c.tipoCreditoEducacao || 'geral',
          creditosHoras: c.creditosHoras || null,
          emitido: false,
        };
      });
  })();

  const certificadosEmitidos = certificados.filter(c => c.emitido);
  const certificadosComAlerta = getCertificadosComAlertaExpiracao(certificadosEmitidos);
  // T1.7.9: separar tiers — críticos (<7d ou expirado) usam destructive,
  // demais (atenção, 7–30d) usam warning (token category-orange via Alert variant=warning).
  const certsCriticos = certificadosComAlerta.filter(
    c => c.expiracaoStatus === 'critico' || c.expiracaoStatus === 'expirado'
  );
  const certsAtencao = certificadosComAlerta.filter(c => c.expiracaoStatus === 'atencao');

  // Emitir certificado
  const handleEmitir = async (cert) => {
    if (emitindo) return;
    const curso = (cursos || []).find(c => c.id === cert.cursoId);
    if (!curso) return;

    setEmitindo(cert.cursoId);
    try {
      // Passa o nome do usuario para persistir no certificado
      const cursoComNome = { ...curso, _userNome: userName };
      const { certificado, error } = await educacaoService.emitirCertificado(userId, cursoComNome);
      if (error) {
        if (import.meta.env.DEV) console.error('Erro ao emitir certificado:', error);
        toast({ variant: 'error', title: 'Erro ao emitir certificado', description: error });
      }
      if (certificado) {
        // Wave 1.9: upload Supabase obrigatório acontece dentro de
        // emitirCertificado. Não há mais step extra de upload Firebase aqui —
        // se chegou aqui sem error, o PDF já está em
        // certificados/${userId}/${certId}.pdf no Supabase Storage.
        toast({ variant: 'success', title: 'Certificado emitido com sucesso' });
        await fetchData();
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao emitir certificado:', err);
      toast({ variant: 'error', title: 'Erro ao emitir certificado', description: err?.message });
    } finally {
      setEmitindo(null);
    }
  };

  // Renovar certificado expirado (re-emite)
  const handleRenovar = async (cert) => {
    if (emitindo) return;
    const curso = (cursos || []).find(c => c.id === cert.cursoId);
    if (!curso) return;

    setEmitindo(cert.cursoId);
    try {
      const cursoComNome = { ...curso, _userNome: userName };
      const { certificado, error } = await educacaoService.emitirCertificado(userId, cursoComNome);
      if (error) {
        if (import.meta.env.DEV) console.error('Erro ao renovar certificado:', error);
        toast({ variant: 'error', title: 'Erro ao renovar certificado', description: error });
      }
      if (certificado) {
        toast({ variant: 'success', title: 'Certificado renovado com sucesso' });
        await fetchData();
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao renovar certificado:', err);
      toast({ variant: 'error', title: 'Erro ao renovar certificado', description: err?.message });
    } finally {
      setEmitindo(null);
    }
  };

  const handleDownload = async (cert) => {
    // Wave 1.9: download apenas via signed URL Supabase (TTL=300s). Fallback
    // Firebase Storage foi removido — após delete-firebase-cert-bucket
    // (T1.9.9) o bucket Firebase deixa de existir.
    try {
      const { signedUrl } = await educacaoService.getCertificadoSignedUrl(cert.id, user.uid);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
      toast({ variant: 'success', title: 'Certificado aberto' });
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[CertificadosPage] download failed:', e?.message || e);
      // Mensagem específica para cert ainda não migrado (cert_pending_backfill):
      // operação manual — admin precisa rodar run-backfill-pending --apply.
      const isPending = (e?.message || '').includes('cert_pending_backfill');
      toast({
        variant: 'error',
        title: 'Falha ao baixar certificado',
        description: isPending
          ? 'Certificado em processo de migração. Tente novamente em alguns minutos ou contate o administrador.'
          : (e?.message || 'Tente novamente.'),
      });
    }
  };

  // T1.2.14: compartilhar conquista via navigator.share + fallback clipboard
  const handleShare = async (cert) => {
    if (!cert?.id) return;
    const url = `${window.location.origin}/verificar/${cert.id}`;
    const tituloCurso = cert.cursoTitulo || 'Treinamento ANEST';
    const text = `Acabei de concluir "${tituloCurso}" na plataforma ANEST. Verifique meu certificado:`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Certificado ANEST · ${tituloCurso}`,
          text,
          url,
        });
        return;
      } catch (err) {
        // AbortError = user cancelou; só caímos no fallback em erro real
        if (err?.name === 'AbortError') return;
        if (import.meta.env.DEV) console.warn('navigator.share falhou, usando fallback:', err);
      }
    }

    // Fallback: copiar URL para clipboard
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast({
          variant: 'success',
          title: 'Link copiado',
          description: 'Cole onde quiser compartilhar.',
        });
      } else {
        toast({
          variant: 'info',
          title: 'Link de verificação',
          description: url,
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Erro ao copiar link:', err);
      toast({
        variant: 'error',
        title: 'Não foi possível copiar',
        description: url,
      });
    }
  };

  const header = <PageHeader title="Historico de Certificados" onBack={goBack} />;

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        {header}
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {header}

      <div className="px-4 pt-4 space-y-4">
        {/* Wave 1.7 T1.7.9 (estende 1.4 T1.4.2): banner expiração em 2 tiers + CTA "Renovar agora" */}
        {certsCriticos.length > 0 && (
          <Alert variant="error">
            <div className="space-y-2">
              <p className="font-semibold">
                {certsCriticos.length === 1
                  ? '1 certificado vence em menos de 7 dias'
                  : `${certsCriticos.length} certificados vencem em menos de 7 dias`}
              </p>
              <ul className="text-sm space-y-1">
                {certsCriticos.slice(0, 3).map((cert) => (
                  <li key={cert.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{cert.cursoTitulo || 'Certificado'}</span>
                    <span>
                      {' — '}
                      {cert.expiracaoStatus === 'expirado'
                        ? `expirado há ${Math.abs(cert.diasParaExpirar)} dia${Math.abs(cert.diasParaExpirar) !== 1 ? 's' : ''}`
                        : cert.diasParaExpirar === 0
                          ? 'expira hoje'
                          : `expira em ${cert.diasParaExpirar} dia${cert.diasParaExpirar !== 1 ? 's' : ''}`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px]"
                      leftIcon={<RefreshCcw className="w-4 h-4" />}
                      onClick={() =>
                        onNavigate?.(
                          cert.cursoOriginalId || cert.cursoId ? 'cursoDetalhe' : 'educacaoContinuada',
                          { cursoId: cert.cursoOriginalId || cert.cursoId }
                        )
                      }
                      aria-label={`Renovar certificado de ${cert.cursoTitulo || 'curso'}`}
                    >
                      Renovar agora
                    </Button>
                  </li>
                ))}
                {certsCriticos.length > 3 && (
                  <li className="text-xs opacity-80">e mais {certsCriticos.length - 3}…</li>
                )}
              </ul>
            </div>
          </Alert>
        )}

        {certsAtencao.length > 0 && (
          <Alert variant="warning">
            <div className="space-y-2">
              <p className="font-semibold">
                {certsAtencao.length === 1
                  ? '1 certificado próximo do vencimento'
                  : `${certsAtencao.length} certificados próximos do vencimento`}
              </p>
              <ul className="text-sm space-y-1">
                {certsAtencao.slice(0, 3).map((cert) => (
                  <li key={cert.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{cert.cursoTitulo || 'Certificado'}</span>
                    <span>
                      {' — '}
                      {cert.diasParaExpirar === 0
                        ? 'expira hoje'
                        : `expira em ${cert.diasParaExpirar} dia${cert.diasParaExpirar !== 1 ? 's' : ''}`}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px]"
                      leftIcon={<RefreshCcw className="w-4 h-4" />}
                      onClick={() =>
                        onNavigate?.(
                          cert.cursoOriginalId || cert.cursoId ? 'cursoDetalhe' : 'educacaoContinuada',
                          { cursoId: cert.cursoOriginalId || cert.cursoId }
                        )
                      }
                      aria-label={`Renovar certificado de ${cert.cursoTitulo || 'curso'}`}
                    >
                      Renovar agora
                    </Button>
                  </li>
                ))}
                {certsAtencao.length > 3 && (
                  <li className="text-xs opacity-80">e mais {certsAtencao.length - 3}…</li>
                )}
              </ul>
            </div>
          </Alert>
        )}

        {/* Certificados Pendentes */}
        {certificadosPendentes.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <Alert variant="warning" className="mb-4">
                Você tem certificado(s) para emitir:
              </Alert>

              <div className="space-y-2">
                {certificadosPendentes.map(cert => (
                  <CertificadoPendenteItem
                    key={cert.id}
                    certificado={cert}
                    onEmitir={handleEmitir}
                    emitindo={emitindo === cert.cursoId}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar size="lg" src={user?.photoURL || user?.avatar} initials={userInitials} />
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {userName}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {userEmail}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-foreground">
                  {certificadosEmitidos.length}
                </span>
                <p className="text-xs text-muted-foreground">certificados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificados Emitidos */}
        <Card>
          <CardContent className="p-4">
            {certificadosEmitidos.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-12 h-12" />}
                title="Nenhum certificado emitido"
                description="Conclua um curso para receber seu primeiro certificado."
                size="sm"
                action={{
                  label: 'Ver cursos disponíveis',
                  onClick: () => onNavigate?.('educacaoContinuada'),
                }}
              />
            ) : (
              <div className="space-y-2">
                {certificadosEmitidos.map(cert => (
                  <CertificadoItem
                    key={cert.id}
                    certificado={cert}
                    onDownload={handleDownload}
                    onRenovar={handleRenovar}
                    onShare={handleShare}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
