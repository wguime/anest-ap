import { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Textarea, Button } from '@/design-system';

export default function FiveWhysForm({ porques, onChange }) {
  // Auto-pad to 5 porquês on mount if existing data has fewer
  useEffect(() => {
    if (porques.length < 5) {
      const padded = [...porques];
      while (padded.length < 5) {
        const n = padded.length + 1;
        padded.push({
          nivel: n,
          pergunta: n === 1 ? 'Por que o incidente ocorreu?' : `Por que? (nível ${n})`,
          resposta: '',
        });
      }
      onChange(padded);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRespostaChange = (index, resposta) => {
    const updated = [...porques];
    updated[index] = { ...updated[index], resposta };
    onChange(updated);
  };

  const handleAddPorque = () => {
    if (porques.length >= 5) return;
    const lastResposta = porques[porques.length - 1]?.resposta || '';
    const novaPergunta = lastResposta
      ? `Por que ${lastResposta.toLowerCase().replace(/\.$/, '')}?`
      : `Por que? (nível ${porques.length + 1})`;

    onChange([
      ...porques,
      { nivel: porques.length + 1, pergunta: novaPergunta, resposta: '' },
    ]);
  };

  const handleRemoveLast = () => {
    if (porques.length <= 1) return;
    onChange(porques.slice(0, -1));
  };

  return (
    <div className="space-y-4">
      {porques.map((pq, index) => (
        <Textarea
          key={pq.nivel}
          label={`${pq.nivel}. ${pq.pergunta}`}
          value={pq.resposta}
          onChange={(val) => handleRespostaChange(index, val)}
          placeholder={`Resposta do nível ${pq.nivel}...`}
          rows={2}
        />
      ))}

      {/* Botões */}
      <div className="flex flex-wrap items-center gap-2">
        {porques.length < 5 && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleAddPorque}
          >
            Adicionar Porquê
          </Button>
        )}
        {porques.length > 1 && (
          <Button
            variant="destructive"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={handleRemoveLast}
          >
            Remover Último
          </Button>
        )}
      </div>
    </div>
  );
}
