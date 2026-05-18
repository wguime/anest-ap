import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert } from '@/design-system';
import { useUser } from '@/contexts/UserContext';
import { getCertificados } from '@/services/educacaoService';
import { getCertificadosComAlertaExpiracao } from '@/utils/certificadoExpiracao';

export function CertificadoExpiracaoBanner({ onNavigate }) {
  const { user } = useUser();
  const userId = user?.uid || user?.id || null;
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { certificados } = await getCertificados(userId);
        if (cancelled) return;
        const emitidos = (certificados || []).filter((c) => c.emitido);
        setAlertas(getCertificadosComAlertaExpiracao(emitidos));
      } catch {
        if (!cancelled) setAlertas([]);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (alertas.length === 0) return null;
  const totalCriticos = alertas.filter((c) => c.expiracaoStatus === 'critico' || c.expiracaoStatus === 'expirado').length;
  const variant = totalCriticos > 0 ? 'destructive' : 'warning';
  const headline = alertas.length === 1
    ? 'Você tem 1 certificado expirando'
    : `Você tem ${alertas.length} certificados expirando`;

  return (
    <button
      type="button"
      onClick={() => onNavigate?.('certificados')}
      className="block w-full text-left mb-4"
      aria-label="Abrir página de certificados"
    >
      <Alert variant={variant} className="cursor-pointer">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{headline}</p>
            <p className="text-sm opacity-90 mt-0.5">
              Toque para revisar e renovar treinamentos vencendo.
            </p>
          </div>
        </div>
      </Alert>
    </button>
  );
}

export default CertificadoExpiracaoBanner;
