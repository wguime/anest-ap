/**
 * QuizFormModal.jsx
 * Modal para admins criarem/editarem perguntas do quiz de um curso.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Textarea,
  FormField,
  Alert,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import * as educacaoService from '@/services/educacaoService';

const EMPTY_QUESTION = {
  texto: '',
  opcoes: ['', '', '', ''],
  respostaCorreta: 0,
};

/**
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} cursoId
 * @param {string} cursoTitulo
 */
export function QuizFormModal({ open, onClose, cursoId, cursoTitulo }) {
  const { user } = useUser();
  const userId = user?.uid || 'system';

  const [perguntas, setPerguntas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Load existing quiz
  useEffect(() => {
    if (!open || !cursoId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(false);

    (async () => {
      const { perguntas: data, error: err } = await educacaoService.getQuiz(cursoId);
      if (cancelled) return;
      if (err) {
        setError(err);
      } else if (data && data.length > 0) {
        setPerguntas(data);
      } else {
        setPerguntas([{ ...EMPTY_QUESTION }]);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, cursoId]);

  const handleAddQuestion = () => {
    setPerguntas(prev => [...prev, { ...EMPTY_QUESTION, opcoes: ['', '', '', ''] }]);
  };

  const handleRemoveQuestion = (index) => {
    if (perguntas.length <= 1) return;
    setPerguntas(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuestionTextChange = (index, text) => {
    setPerguntas(prev => prev.map((p, i) => i === index ? { ...p, texto: text } : p));
  };

  const handleOptionChange = (qIndex, optIndex, text) => {
    setPerguntas(prev => prev.map((p, i) => {
      if (i !== qIndex) return p;
      const opcoes = [...p.opcoes];
      opcoes[optIndex] = text;
      return { ...p, opcoes };
    }));
  };

  const handleCorrectAnswerChange = (qIndex, optIndex) => {
    setPerguntas(prev => prev.map((p, i) =>
      i === qIndex ? { ...p, respostaCorreta: optIndex } : p
    ));
  };

  const validate = () => {
    for (let i = 0; i < perguntas.length; i++) {
      const p = perguntas[i];
      if (!p.texto.trim()) {
        setError(`Pergunta ${i + 1}: texto é obrigatório`);
        return false;
      }
      const filledOptions = p.opcoes.filter(o => o.trim());
      if (filledOptions.length < 2) {
        setError(`Pergunta ${i + 1}: pelo menos 2 opções são necessárias`);
        return false;
      }
      if (!p.opcoes[p.respostaCorreta]?.trim()) {
        setError(`Pergunta ${i + 1}: a resposta correta selecionada está vazia`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    if (!validate()) return;

    setSaving(true);
    // Clean up: remove empty trailing options
    const cleanPerguntas = perguntas.map(p => ({
      texto: p.texto.trim(),
      opcoes: p.opcoes.map(o => o.trim()).filter(o => o),
      respostaCorreta: p.respostaCorreta,
    }));

    const { success: ok, error: err } = await educacaoService.salvarQuiz(cursoId, cleanPerguntas, userId);
    setSaving(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      setTimeout(() => onClose?.(), 1200);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Quiz: ${cursoTitulo || 'Treinamento'}`}
      size="lg"
    >
      <div className="space-y-6 p-1 overflow-y-auto max-h-[calc(90vh-120px)]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Questions list */}
            <div className="space-y-6">
              {perguntas.map((pergunta, qIndex) => (
                <div
                  key={qIndex}
                  className="p-4 rounded-xl border border-border bg-muted/20 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">
                        Pergunta {qIndex + 1}
                      </span>
                    </div>
                    {perguntas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        title="Remover pergunta"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <FormField label="Enunciado" required>
                    <Textarea
                      value={pergunta.texto}
                      onChange={(value) => handleQuestionTextChange(qIndex, value)}
                      placeholder="Digite a pergunta..."
                      rows={2}
                    />
                  </FormField>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Opções <span className="text-xs text-muted-foreground">(clique no circulo para marcar a correta)</span>
                    </label>
                    {pergunta.opcoes.map((opcao, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCorrectAnswerChange(qIndex, optIndex)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            pergunta.respostaCorreta === optIndex
                              ? "border-success bg-success text-white"
                              : "border-muted-foreground hover:border-primary"
                          )}
                          title={pergunta.respostaCorreta === optIndex ? 'Resposta correta' : 'Marcar como correta'}
                        >
                          {pergunta.respostaCorreta === optIndex && (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <Input
                          value={opcao}
                          onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                          placeholder={`Opção ${String.fromCharCode(65 + optIndex)}`}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddQuestion}
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full"
            >
              Adicionar Pergunta
            </Button>

            {error && (
              <Alert variant="destructive">{error}</Alert>
            )}

            {success && (
              <Alert variant="success" title="Quiz salvo">
                {perguntas.length} pergunta(s) salva(s) com sucesso.
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                leftIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              >
                {saving ? 'Salvando...' : `Salvar Quiz (${perguntas.length} perguntas)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default QuizFormModal;
