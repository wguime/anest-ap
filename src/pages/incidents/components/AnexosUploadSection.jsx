import { useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { validarAnexos, formatAnexoSize, ANEXO_MAX_COUNT, ANEXO_MAX_MB, ANEXO_ACCEPT } from '@/lib/incidenteAnexos';

/**
 * Seção "Anexos" dos formulários de denúncia/incidente.
 *
 * Guarda os File objects REAIS — o upload acontece no submit da página.
 * (Bug 2026-07-30: a versão anterior guardava só `file.name` e a evidência
 * nunca saía do browser — DEN-20260727-8445 ficou sem o anexo.)
 *
 * @param {File[]} anexos - arquivos selecionados (estado da página)
 * @param {(files: File[]) => void} onChange
 * @param {string} inputId - id único do input (duas páginas usam a seção)
 * @param {boolean} anonimo - relato anônimo: nome do arquivo não é armazenado
 *   (LGPD B1) e o aviso de metadados internos (EXIF/autor) é exibido
 */
export default function AnexosUploadSection({ anexos, onChange, inputId = 'anexos-upload', anonimo = false }) {
  const [erro, setErro] = useState('');

  const handleSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // permite re-selecionar o mesmo arquivo após remover
    if (files.length === 0) return;
    const res = validarAnexos(files, anexos);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    setErro('');
    onChange([...anexos, ...files]);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Anexos (opcional)
      </h3>

      <div className="p-4 rounded-xl border-2 border-dashed border-border bg-muted">
        <div className="flex flex-col items-center text-center">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">
            Toque para selecionar arquivos de evidência
          </p>
          <p className="text-xs text-muted-foreground">
            Imagens (JPG, PNG, HEIC) ou PDF — até {ANEXO_MAX_COUNT} arquivos de {ANEXO_MAX_MB}MB
          </p>
          {/* accept + a validação de tipo em validarAnexos: desde 06/09/2026 o
              balde recusa o que está fora da lista, e falha de upload bloqueia o
              relato inteiro. Melhor filtrar no seletor do que perder o relato. */}
          <input
            type="file"
            multiple
            accept={ANEXO_ACCEPT}
            className="hidden"
            id={inputId}
            onChange={handleSelect}
          />
          <label
            htmlFor={inputId}
            className="mt-3 px-4 py-2.5 rounded-lg bg-card border border-border text-sm font-medium text-foreground cursor-pointer hover:bg-muted transition-colors"
          >
            Selecionar arquivos
          </label>
        </div>
      </div>

      {erro && (
        <p className="text-xs text-destructive mt-2" role="alert">{erro}</p>
      )}

      {anonimo && anexos.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          Relato anônimo: o nome dos arquivos não será armazenado (vira
          &quot;evidencia-1&quot;, &quot;evidencia-2&quot;…). Atenção: fotos e documentos podem
          conter metadados internos (localização, autor) que identificam você —
          se necessário, remova-os antes de anexar.
        </p>
      )}

      {anexos.length > 0 && (
        <div className="mt-3 space-y-2">
          {anexos.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 p-2 pl-3 rounded-lg bg-muted"
            >
              <span className="flex-1 text-sm text-foreground truncate">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatAnexoSize(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remover ${file.name}`}
                onClick={() => onChange(anexos.filter((_, i) => i !== index))}
                className="w-11 h-11 -my-2 flex items-center justify-center rounded-lg hover:bg-accent flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
