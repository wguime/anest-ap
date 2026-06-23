import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button, useToast } from '@/design-system';
import { useHaptic } from '@/design-system/hooks';

/**
 * Justificativa já pronta (texto completo, somente leitura) + copiar.
 * Diferente do gerador editável: ao abrir, o texto já vem completo.
 */
export default function JustificativaPronta({ texto }) {
  const { toast } = useToast();
  const haptic = useHaptic();
  const [copied, setCopied] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      haptic('success');
      toast({ title: 'Justificativa copiada', variant: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'error' });
    }
  };

  return (
    <div className="mt-3">
      {/* bloco que mostra o texto inteiro, sem rolagem interna (preserva quebras de linha) */}
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground whitespace-pre-line">
        {texto}
      </div>
      <div className="flex justify-end mt-2">
        <Button
          variant="outline"
          size="sm"
          leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          onClick={copiar}
        >
          {copied ? 'Copiado' : 'Copiar justificativa'}
        </Button>
      </div>
    </div>
  );
}
