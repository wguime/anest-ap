import { useEffect, useMemo, useState } from 'react';
import { Calculator, BookOpen, Search, X, Trash2 } from 'lucide-react';
import { Card, Button, Badge, Select, Tabs, TabsList, TabsTrigger, Input, EmptyState } from '@/design-system';
import { PageHeader } from '@/components';
import { calcularGuia } from '@/lib/codificacaoAnest';
import { CODIGOS_POR_CATEGORIA, formatarMoeda } from '@/data/codigosAnestesia';
import CodigoAutocomplete from './components/CodigoAutocomplete';
import JustificativaGerador from './components/JustificativaGerador';

const STATUS_META = {
  paga_embutida: { label: 'Anestesia paga', variant: 'success' },
  recomenda_codigo: { label: 'Adicionar código', variant: 'warning' },
  sem_cobertura: { label: 'Sem cobertura', variant: 'destructive' },
  revisar: { label: 'Não encontrado', variant: 'secondary' },
};

const TABELA_OPTS = [
  { value: 'intercambio', label: 'Intercâmbio Nacional (1,17)' },
  { value: 'local', label: 'Unimed Chapecó (1,73)' },
];
const MODO_OPTS = [
  { value: 'percentualizado', label: 'Anestesia percentualizada (instr. 7)' },
  { value: 'somente_maior', label: 'Anestesia: só o maior (100%)' },
];
const VIA_OPTS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Via ${n}` }));

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

function Info({ rotulo, valor }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="font-medium">{valor ?? '—'}</div>
    </div>
  );
}

function ResultadoLinha({ linha, onRemove, onChangeVia }) {
  const [showJust, setShowJust] = useState(false);
  const meta = STATUS_META[linha.statusAnestesia] || STATUS_META.revisar;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold tabular-nums">{linha.codigo}</span>
            {linha.lista && <Badge variant="outline">{linha.lista}</Badge>}
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{linha.descricao || 'Código não encontrado na referência'}</p>
        </div>
        <div className="flex items-start gap-2 shrink-0">
          <div className="text-right">
            {linha.valorAnestesistaPago != null && (
              <div className="font-bold text-success">{formatarMoeda(linha.valorAnestesistaPago)}</div>
            )}
            {linha.percentualAnestesico != null && (
              <div className="text-[11px] text-muted-foreground">anestesia {pct(linha.percentualAnestesico)}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(linha.codigo)}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={`Remover ${linha.codigo}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {linha.encontrado && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[12px]">
          <Info rotulo="Porte cir." valor={linha.porteCirurgico} />
          <Info rotulo="Porte anest." valor={linha.porteAnestesico} />
          <Info rotulo="Classificação" valor={linha.classificacao} />
          <Info
            rotulo="Cirurgião"
            valor={
              linha.valorCirurgiaoPago != null
                ? `${formatarMoeda(linha.valorCirurgiaoPago)} (${pct(linha.percentualCirurgico)})`
                : null
            }
          />
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-muted-foreground">Via de acesso:</span>
        <Select value={linha.via} onChange={(v) => onChangeVia(linha.codigo, v)} options={VIA_OPTS} size="sm" />
      </div>

      {linha.documentacao && (
        <p className="text-[11px] text-warning mt-2">⚠ Documentação exigida: {linha.documentacao}</p>
      )}

      {linha.statusAnestesia === 'recomenda_codigo' && linha.recomendacao && (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="text-[12px] font-semibold text-warning-foreground">
            Anestesia não remunerada neste código. Adicione:
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="warning">{linha.recomendacao.principal.codigo}</Badge>
            <span className="text-sm">{linha.recomendacao.principal.descricao}</span>
            {linha.recomendacao.principal.valor != null && (
              <span className="text-sm font-semibold">{formatarMoeda(linha.recomendacao.principal.valor)}</span>
            )}
          </div>
          {linha.recomendacao.alternativa?.codigo && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Alternativa: {linha.recomendacao.alternativa.codigo} — {linha.recomendacao.alternativa.descricao}
            </p>
          )}
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowJust((s) => !s)}>
            {showJust ? 'Ocultar justificativa' : 'Gerar justificativa'}
          </Button>
          {showJust && (
            <JustificativaGerador procedimentoInicial={linha.descricao || ''} recomendacao={linha.recomendacao} />
          )}
        </div>
      )}
    </Card>
  );
}

function Total({ rotulo, valor, destaque }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={`font-bold ${destaque ? 'text-success text-lg' : ''}`}>{formatarMoeda(valor)}</div>
    </div>
  );
}

export default function CodificacaoAnestesicaPage({ goBack }) {
  const [activeTab, setActiveTab] = useState('calculadora');
  const [itens, setItens] = useState([]); // [{...registro, via}]
  const [tabela, setTabela] = useState('intercambio');
  const [modoAnestesia, setModoAnestesia] = useState('percentualizado');
  const [buscaConsulta, setBuscaConsulta] = useState('');

  useEffect(() => {
    document.title = 'Codificação Anestésica — ANEST';
  }, []);

  const addCodigo = (reg) => {
    setItens((prev) => (prev.some((i) => i.codigo === reg.codigo) ? prev : [...prev, { ...reg, via: '1' }]));
  };
  const removeCodigo = (codigo) => setItens((prev) => prev.filter((i) => i.codigo !== codigo));
  const changeVia = (codigo, via) => setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, via } : i)));
  const limpar = () => setItens([]);

  const resultado = useMemo(() => {
    if (itens.length === 0) return null;
    return calcularGuia(
      itens.map((r) => ({ codigo: r.codigo, registro: r, via: r.via })),
      { tabela, modoAnestesia }
    );
  }, [itens, tabela, modoAnestesia]);

  const consultaFiltrada = useMemo(() => {
    const q = buscaConsulta.trim().toLowerCase();
    if (!q) return CODIGOS_POR_CATEGORIA;
    return CODIGOS_POR_CATEGORIA.map((cat) => ({
      ...cat,
      codigos: cat.codigos.filter(
        (c) => c.codigo.includes(q) || c.descricao.toLowerCase().includes(q) || c.quandoUsar.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.codigos.length > 0);
  }, [buscaConsulta]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Codificação Anestésica" subtitle="Cobrança e códigos Unimed" onBack={goBack} />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4 max-w-3xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="underline" className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="calculadora" className="flex-1 justify-center gap-1.5">
              <Calculator className="w-4 h-4" /> Calculadora
            </TabsTrigger>
            <TabsTrigger value="consulta" className="flex-1 justify-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Consulta
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'calculadora' && (
          <div className="space-y-4">
            <Card className="p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                Adicione os códigos autorizados
              </label>
              <CodigoAutocomplete onAdd={addCodigo} jaAdicionados={itens.map((i) => i.codigo)} />
              <p className="text-[11px] text-muted-foreground mt-2">
                Digite o código TUSS ou o nome do procedimento e escolha na lista. Adicione quantos quiser — o cálculo é automático.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <Select value={tabela} onChange={setTabela} options={TABELA_OPTS} size="sm" />
                <Select value={modoAnestesia} onChange={setModoAnestesia} options={MODO_OPTS} size="sm" />
              </div>
            </Card>

            {!resultado ? (
              <EmptyState
                icon={<Calculator className="w-6 h-6" />}
                title="Nenhum código adicionado"
                description="Use o campo acima para montar a guia."
              />
            ) : (
              <>
                <Card className="p-4 bg-primary/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {itens.length} código{itens.length > 1 ? 's' : ''}
                    </span>
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={limpar}>
                      Limpar
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Total rotulo="Cirurgião" valor={resultado.totais.totalCirurgiao} />
                    <Total rotulo="Anestesista" valor={resultado.totais.totalAnestesista} destaque />
                    <Total rotulo="Total geral" valor={resultado.totais.totalGeral} />
                  </div>
                  {resultado.totais.totalRecomendado > 0 && (
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      + {formatarMoeda(resultado.totais.totalRecomendado)} potenciais se adicionados os códigos recomendados
                    </p>
                  )}
                </Card>

                <div className="space-y-3">
                  {resultado.linhas.map((l) => (
                    <ResultadoLinha key={l.codigo} linha={l} onRemove={removeCodigo} onChangeVia={changeVia} />
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ⚠ Os percentuais redutores não constam da tabela referencial (regra de auditoria, defaults
                  CBHPM/Unimed editáveis). Valores são estimativa de conferência e não substituem a auditoria
                  da Unimed Executora. A tabela Chapecó (1,73) é derivada do Intercâmbio (1,17).
                </p>
              </>
            )}
          </div>
        )}

        {activeTab === 'consulta' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={buscaConsulta}
                onChange={(e) => setBuscaConsulta(e.target.value)}
                placeholder="Buscar por código, procedimento ou situação…"
                className="pl-9"
              />
            </div>
            <p className="text-[12px] text-muted-foreground">
              Códigos que o anestesista fatura diretamente, agrupados por situação. Toque numa categoria para usar.
            </p>

            {consultaFiltrada.length === 0 ? (
              <EmptyState title="Nada encontrado" description="Ajuste a busca." />
            ) : (
              consultaFiltrada.map((cat) => (
                <section key={cat.categoria} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <header className="border-l-4 border-primary bg-primary/5 px-4 py-2.5">
                    <h3 className="text-sm font-bold text-foreground">{cat.label}</h3>
                    <p className="text-[11px] text-muted-foreground">{cat.descricao}</p>
                  </header>
                  <div className="divide-y divide-border">
                    {cat.codigos.map((c) => (
                      <div key={c.codigo} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold tabular-nums">{c.codigo}</span>
                            {c.indicador && <Badge variant="outline">{c.indicador}</Badge>}
                          </div>
                          <Badge variant="success">{formatarMoeda(c.valor)}</Badge>
                        </div>
                        <p className="text-sm font-medium mt-1">{c.descricao}</p>
                        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{c.quandoUsar}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
