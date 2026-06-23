import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button, Textarea, useToast } from '@/design-system';
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
      <Textarea value={texto} readOnly rows={9} className="text-sm leading-relaxed" />
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
