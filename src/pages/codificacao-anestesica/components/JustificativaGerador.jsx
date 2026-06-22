import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card, Input, Textarea, Button, useToast } from '@/design-system';
import { useHaptic } from '@/design-system/hooks';
import { gerarJustificativa } from '@/lib/codificacaoAnest';

/**
 * Gerador de justificativa clínica para o código de anestesia recomendado.
 * Campos editáveis → template; botão copiar (clipboard + toast + haptic).
 */
export default function JustificativaGerador({ procedimentoInicial = '', recomendacao }) {
  const { toast } = useToast();
  const haptic = useHaptic();
  const [copied, setCopied] = useState(false);
  const [campos, setCampos] = useState({
    procedimento: procedimentoInicial,
    motivoClinico: '',
    tecnica: '',
    paciente: '',
    cid: '',
  });

  const principal = recomendacao?.principal;

  const texto = useMemo(
    () =>
      gerarJustificativa({
        ...campos,
        codigoRecomendado: principal?.codigo || '',
        descricaoRecomendado: principal?.descricao || '',
      }),
    [campos, principal]
  );

  const set = (k) => (e) => setCampos((c) => ({ ...c, [k]: e.target.value }));

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
    <Card className="p-4 mt-3 bg-muted/40">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-3">
        Gerar justificativa {principal?.codigo ? `— ${principal.codigo}` : ''}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <Input value={campos.procedimento} onChange={set('procedimento')} placeholder="Procedimento realizado" />
        <Input value={campos.cid} onChange={set('cid')} placeholder="CID" />
        <Input value={campos.motivoClinico} onChange={set('motivoClinico')} placeholder="Motivo clínico (ex.: imperativo clínico)" />
        <Input value={campos.tecnica} onChange={set('tecnica')} placeholder="Técnica anestésica" />
        <Input
          value={campos.paciente}
          onChange={set('paciente')}
          placeholder="Condição do paciente (idade, comorbidades)"
          className="sm:col-span-2"
        />
      </div>
      <Textarea value={texto} readOnly rows={9} className="text-sm leading-relaxed" />
      <div className="flex justify-end mt-2">
        <Button variant="outline" size="sm" leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} onClick={copiar}>
          {copied ? 'Copiado' : 'Copiar justificativa'}
        </Button>
      </div>
    </Card>
  );
}
