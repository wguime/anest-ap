import { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Loader2, Star } from 'lucide-react';
import { Input } from '@/design-system';
import { searchCodigos } from '@/services/supabaseUnimedTussService';
import { formatarMoeda } from '@/data/codigosAnestesia';

const FAV_KEY = 'anest-cod-fav';

function lerFavoritos() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Campo de digitação de código TUSS com sugestões ao vivo (server-backed) + favoritos.
 * Digite código (prefixo) ou trecho da descrição → escolha para adicionar à guia.
 * A estrela favorita o código (localStorage); com o campo vazio, mostra os favoritos.
 */
export default function CodigoAutocomplete({ onAdd, jaAdicionados = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [favoritos, setFavoritos] = useState(lerFavoritos);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);
  const reqSeqRef = useRef(0); // descarta respostas RPC fora de ordem (digitação rápida)

  const favSet = new Set(favoritos.map((f) => f.codigo));

  const buscar = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++reqSeqRef.current;
    if (q.trim().length < 2) {
      setResults([]);
      setActive(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchCodigos(q, 25);
        if (seq !== reqSeqRef.current) return; // chegou tarde: query já mudou
        setResults(r);
        setOpen(true);
        setActive(0);
      } catch {
        if (seq === reqSeqRef.current) setResults([]);
      } finally {
        if (seq === reqSeqRef.current) setLoading(false);
      }
    }, 220);
  }, []);

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), []);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  const persistFav = (next) => {
    setFavoritos(next);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* storage indisponível — ignora */
    }
  };

  const toggleFav = (reg) => {
    if (favSet.has(reg.codigo)) persistFav(favoritos.filter((f) => f.codigo !== reg.codigo));
    else persistFav([...favoritos, reg]);
  };

  const adicionar = (reg) => {
    onAdd(reg);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const onChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    buscar(e.target.value);
  };

  // lista exibida: resultados da busca, ou favoritos quando o campo está vazio
  const mostrandoFavoritos = query.trim().length < 2;
  const lista = mostrandoFavoritos ? favoritos : results;

  const onKeyDown = (e) => {
    if (!open || lista.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, lista.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = lista[active];
      if (r) adicionar(r);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="Digite o código ou nome do procedimento…"
          aria-label="Buscar código TUSS"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {open && (
        <div className="absolute z-dropdown mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-border-strong bg-card shadow-lg">
          {mostrandoFavoritos && (
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40">
              {favoritos.length ? 'Favoritos' : 'Favorite códigos (estrela) para acesso rápido'}
            </div>
          )}
          {lista.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {mostrandoFavoritos ? 'Nenhum favorito ainda.' : 'Nenhum código encontrado.'}
            </div>
          ) : (
            lista.map((r, i) => {
              const dup = jaAdicionados.includes(r.codigo);
              const pagaAnest = r.indicadorAnestesico != null && r.valorAnestesista != null;
              const fav = favSet.has(r.codigo);
              return (
                <div
                  key={r.codigo}
                  onMouseEnter={() => setActive(i)}
                  className={`flex items-start gap-2 px-3 py-2 border-b border-border last:border-0 ${i === active ? 'bg-muted' : ''}`}
                >
                  <button
                    type="button"
                    disabled={dup}
                    onClick={() => !dup && adicionar(r)}
                    className={`min-w-0 flex-1 text-left flex items-start gap-2 ${dup ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Plus className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold tabular-nums">{r.codigo}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.lista}</span>
                        {pagaAnest ? (
                          <span className="text-[11px] font-semibold text-primary">anestesia {formatarMoeda(r.valorAnestesista)}</span>
                        ) : (
                          <span className="text-[11px] text-warning">sem anestesia</span>
                        )}
                        {dup && <span className="text-[11px] text-muted-foreground">(já adicionado)</span>}
                      </span>
                      <span className="block text-[12px] text-muted-foreground leading-snug">{r.descricao}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFav(r)}
                    className="shrink-0 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={fav ? `Desfavoritar ${r.codigo}` : `Favoritar ${r.codigo}`}
                  >
                    <Star className={`w-4 h-4 ${fav ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
