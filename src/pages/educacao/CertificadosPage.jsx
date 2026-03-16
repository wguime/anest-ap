import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import {
  Card,
  CardContent,
  Alert,
  Avatar,
  EmptyState,
  Spinner,
  useToast,
} from '@/design-system';
import { CertificadoItem, CertificadoPendenteItem } from './components/CertificadoItem';
import { formatData } from './data/educacaoUtils';
import { useUser } from '@/contexts/UserContext';
import { useEducacaoData } from './hooks/useEducacaoData';
import * as educacaoService from '@/services/educacaoService';
import { downloadCertificate, uploadCertificatePDF } from './utils/certificateGenerator';

export default function CertificadosPage({ onNavigate, goBack }) {
  const { toast } = useToast();
  const { user } = useUser();
  const userId = user?.uid || user?.id || 'system';
  const { cursos, useMock } = useEducacaoData();

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
      console.error('Erro ao buscar dados de certificados:', err);
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
        console.error('Erro ao emitir certificado:', error);
        toast({ variant: 'error', title: 'Erro ao emitir certificado', description: error });
      }
      if (certificado) {
        // Gerar e fazer upload do PDF para o Storage (QR code abrira o PDF)
        try {
          await uploadCertificatePDF(certificado, userName);
        } catch (e) {
          console.warn('Erro ao upload PDF do certificado:', e);
        }
        toast({ variant: 'success', title: 'Certificado emitido com sucesso' });
        await fetchData();
      }
    } catch (err) {
      console.error('Erro ao emitir certificado:', err);
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
        console.error('Erro ao renovar certificado:', error);
        toast({ variant: 'error', title: 'Erro ao renovar certificado', description: error });
      }
      if (certificado) {
        toast({ variant: 'success', title: 'Certificado renovado com sucesso' });
        await fetchData();
      }
    } catch (err) {
      console.error('Erro ao renovar certificado:', err);
      toast({ variant: 'error', title: 'Erro ao renovar certificado', description: err?.message });
    } finally {
      setEmitindo(null);
    }
  };

  const handleDownload = async (cert) => {
    try {
      await downloadCertificate(cert, userName);
      toast({ variant: 'success', title: 'Certificado aberto' });
    } catch (error) {
      console.error('Erro ao abrir certificado:', error);
      toast({ variant: 'error', title: 'Erro ao abrir certificado', description: error?.message });
    }
  };

  // Header element
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Historico de Certificados
          </h1>
          <div className="min-w-[70px] flex justify-end" />
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {createPortal(headerElement, document.body)}
        <div className="h-14" aria-hidden="true" />
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 pt-4 space-y-4">
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
                description="Complete cursos para receber certificados"
                compact
              />
            ) : (
              <div className="space-y-2">
                {certificadosEmitidos.map(cert => (
                  <CertificadoItem
                    key={cert.id}
                    certificado={cert}
                    onDownload={handleDownload}
                    onRenovar={handleRenovar}
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
