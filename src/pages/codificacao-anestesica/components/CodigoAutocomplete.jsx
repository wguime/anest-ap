import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/design-system';
import { searchCodigos } from '@/services/supabaseUnimedTussService';
import { formatarMoeda } from '@/data/codigosAnestesia';

/**
 * Campo de digitação de código TUSS com sugestões ao vivo (server-backed).
 * Digite código (prefixo) ou trecho da descrição → escolha para adicionar à guia.
 */
export default function CodigoAutocomplete({ onAdd, jaAdicionados = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  const buscar = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchCodigos(q, 25);
        setResults(r);
        setOpen(true);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
  }, []);

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), []);

  // fecha ao clicar fora
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const adicionar = (reg) => {
    onAdd(reg);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onChange = (e) => {
    setQuery(e.target.value);
    buscar(e.target.value);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active];
      if (r) adicionar(r);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Digite o código ou nome do procedimento…"
          className="pl-9"
          aria-label="Buscar código TUSS"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {open && (
        <div className="absolute z-dropdown mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-border-strong bg-card shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum código encontrado.</div>
          ) : (
            results.map((r, i) => {
              const dup = jaAdicionados.includes(r.codigo);
              const pagaAnest = r.indicadorAnestesico != null && r.valorAnestesista != null;
              return (
                <button
                  key={r.codigo}
                  type="button"
                  disabled={dup}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => !dup && adicionar(r)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2 border-b border-border last:border-0 transition-colors ${
                    i === active ? 'bg-muted' : ''
                  } ${dup ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}`}
                >
                  <Plus className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold tabular-nums">{r.codigo}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.lista}</span>
                      {pagaAnest ? (
                        <span className="text-[11px] font-semibold text-success">anestesia {formatarMoeda(r.valorAnestesista)}</span>
                      ) : (
                        <span className="text-[11px] text-warning">sem anestesia</span>
                      )}
                      {dup && <span className="text-[11px] text-muted-foreground">(já adicionado)</span>}
                    </span>
                    <span className="block text-[12px] text-muted-foreground leading-snug">{r.descricao}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
