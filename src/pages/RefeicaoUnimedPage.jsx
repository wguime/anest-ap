import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components';

// Página exclusiva de solicitação de refeições (Unimed Chapecó / Hoobox Forms).
// URL fixa do QR Code do mural — abre embutida no app (iframe), sem jogar o
// usuário pro navegador externo. Os headers da Hoobox não bloqueiam framing.
const REFEICAO_URL =
  'https://app.forms.hoobox.one/?u=unichap_copamed&p=hbx@unichap&k=null&pr=7fb41e47-83ac-4738-be1d-66604be1c142&v=2';

export default function RefeicaoUnimedPage({ goBack }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = 'Refeição Unimed — ANEST';
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      <PageHeader
        title="Refeição Unimed"
        subtitle="Solicitação de refeições"
        onBack={goBack}
        actions={
          <a
            href={REFEICAO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity min-h-[44px] px-1"
            aria-label="Abrir em nova aba"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        }
      />

      <div className="relative flex-1 min-h-0">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        )}
        <iframe
          src={REFEICAO_URL}
          title="Solicitação de refeição — Unimed"
          className="w-full h-full border-0"
          onLoad={() => setLoaded(true)}
          allow="camera; clipboard-write"
        />
      </div>

      {/* Reserva espaço pro BottomNav global (fixed) não cobrir o rodapé do form */}
      <div
        aria-hidden="true"
        className="shrink-0 h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
      />
    </div>
  );
}
