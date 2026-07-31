import { useState } from 'react';
import { Paperclip, FileText } from 'lucide-react';
import { useToast } from '@/design-system';
import supabaseIncidentsService from '@/services/supabaseIncidentsService';
import { anexoNome, formatAnexoSize } from '@/lib/incidenteAnexos';
import ExpandableSection from './ExpandableSection';

/**
 * Seção "Anexos" (read-only) dos detalhes de denúncia/incidente.
 * Download por signed URL de curta duração gerada a cada clique —
 * RLS do bucket: admin ou dono do upload identificado.
 * Tolera o formato legado (string solta, sem arquivo no Storage).
 */
export default function AnexosListSection({ attachments, variant }) {
  const { toast } = useToast();
  const [baixando, setBaixando] = useState(null);

  if (!attachments?.length) return null;

  const handleBaixar = async (att) => {
    setBaixando(att.path);
    try {
      const url = await supabaseIncidentsService.getAnexoSignedUrl(att.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Erro ao gerar link do anexo:', err);
      toast.error('Não foi possível baixar o anexo — sem permissão ou arquivo indisponível.');
    } finally {
      setBaixando(null);
    }
  };

  return (
    <ExpandableSection
      variant={variant}
      title="Anexos"
      icon={Paperclip}
      badge={`${attachments.length}`}
    >
      <div className="space-y-2">
        {attachments.map((att, index) => {
          const size = formatAnexoSize(att?.size);
          return (
            <div
              key={att?.path || index}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted"
            >
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{anexoNome(att)}</p>
                {size && <p className="text-xs text-muted-foreground">{size}</p>}
              </div>
              {att?.path ? (
                <button
                  type="button"
                  onClick={() => handleBaixar(att)}
                  disabled={baixando === att.path}
                  className={`min-h-11 px-3 flex items-center text-xs font-medium disabled:opacity-50 ${
                    variant === 'purple' ? 'text-category-purple-fg' : 'text-primary'
                  }`}
                >
                  {baixando === att.path ? 'Gerando…' : 'Baixar'}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  arquivo não recebido
                </span>
              )}
            </div>
          );
        })}
      </div>
    </ExpandableSection>
  );
}
