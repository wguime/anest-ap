import { useEffect, useMemo, useState } from 'react';
import { Calculator, BookOpen, X, Trash2, Minus, Plus, Wand2, Check, ChevronDown } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  Input,
  Switch,
  EmptyState,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from '@/design-system';
import { PageHeader } from '@/components';
import { calcularGuia, sugerirPercentuais } from '@/lib/codificacaoAnest';
import { OPCOES_PERCENTUAL, ACOMODACOES, ACOMODACAO_PADRAO, MULTIPLICADORES } from '@/lib/codificacaoAnestRules';
import { CODIGOS_POR_CATEGORIA, formatarMoeda } from '@/data/codigosAnestesia';
import CodigoAutocomplete from './components/CodigoAutocomplete';
import JustificativaGerador from './components/JustificativaGerador';

const STATUS_META = {
  paga_embutida: { label: 'Anestesia paga', variant: 'success' },
  recomenda_codigo: { label: 'Adicionar código', variant: 'warning' },
  sem_cobertura: { label: 'Sem cobertura', variant: 'destructive' },
  revisar: { label: 'Não encontrado', variant: 'secondary' },
};

const ACOMODACAO_OPTS = ACOMODACOES.map((a) => ({ value: a.value, label: a.label }));
const FATOR_LOCAL = MULTIPLICADORES.local / MULTIPLICADORES.intercambio;
// valores armazenados estão em intercâmbio (1,17); a Consulta exibe sempre local (1,73)
const valorLocal = (v) => (v == null ? null : Math.round(v * FATOR_LOCAL * 100) / 100);

/** maior valor = 100% (Principal); demais = 50% (Mesma via). Só nas linhas não-manuais. */
function reaplicarAuto(items, forcar = false) {
  const base = forcar ? items.map((i) => ({ ...i, manual: false })) : items;
  const ordenado = [...base].sort(
    (a, b) => (b.valorCirurgiao || b.valorAnestesista || 0) - (a.valorCirurgiao || a.valorAnestesista || 0)
  );
  const topCodigo = ordenado[0]?.codigo;
  return base.map((it) => (it.manual ? it : { ...it, percentual: it.codigo === topCodigo ? 100 : 50 }));
}

function Info({ rotulo, valor }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="font-medium">{valor ?? '—'}</div>
    </div>
  );
}

function PercentualBadge({ value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-success font-bold tabular-nums"
          aria-label="Percentual do procedimento"
        >
          {value}% <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" minWidth={240}>
        {OPCOES_PERCENTUAL.map((o) => (
          <DropdownItem
            key={o.v}
            icon={o.v === value ? <Check className="w-4 h-4" /> : <span className="w-4" />}
            onClick={() => onChange(o.v)}
          >
            <span className="font-semibold tabular-nums mr-1">{o.v}%</span>
            {o.label !== `${o.v}%` && <span className="text-muted-foreground">— {o.label}</span>}
          </DropdownItem>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

function ResultadoLinha({ linha, onRemove, onQtd, onPercentual }) {
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
          <p className="text-sm text-muted-foreground mt-1 leading-snug">
            {linha.descricao || 'Código não encontrado na referência'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(linha.codigo)}
          className="text-muted-foreground hover:text-destructive transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          aria-label={`Remover ${linha.codigo}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onQtd(linha.codigo, linha.quantidade - 1)}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40"
              disabled={linha.quantidade <= 1}
              aria-label="Diminuir quantidade"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-6 text-center font-semibold tabular-nums">{linha.quantidade}</span>
            <button
              type="button"
              onClick={() => onQtd(linha.codigo, linha.quantidade + 1)}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-success hover:bg-success/10"
              aria-label="Aumentar quantidade"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <PercentualBadge value={linha.percentual} onChange={(v) => onPercentual(linha.codigo, v)} />
        </div>
        <div className="text-right">
          {linha.valorAnestesistaPago != null ? (
            <div className="font-bold text-success">{formatarMoeda(linha.valorAnestesistaPago)}</div>
          ) : (
            <div className="text-sm text-muted-foreground">anestesia —</div>
          )}
          {linha.valorCirurgiaoPago != null && (
            <div className="text-[11px] text-muted-foreground">cirurgião {formatarMoeda(linha.valorCirurgiaoPago)}</div>
          )}
        </div>
      </div>

      {linha.encontrado && (
        <div className="grid grid-cols-3 gap-2 mt-3 text-[12px]">
          <Info rotulo="Porte cir." valor={linha.porteCirurgico} />
          <Info rotulo="Porte anest." valor={linha.porteAnestesico} />
          <Info rotulo="Classificação" valor={linha.classificacao} />
        </div>
      )}

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

function ConsultaItem({ c }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors"
      >
        <div className="min-w-0">
          <span className="font-bold tabular-nums">{c.codigo}</span>
          <p className="text-sm font-medium mt-0.5">{c.descricao}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="font-bold text-success">{formatarMoeda(valorLocal(c.valor))}</div>
            {c.indicador && <div className="text-[10px] text-muted-foreground">ind. {c.indicador}</div>}
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <p className="px-4 pb-3 -mt-1 text-[12px] text-muted-foreground leading-relaxed">{c.quandoUsar}</p>
      )}
    </div>
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
  const [itens, setItens] = useState([]); // [{...registro, quantidade, percentual, manual}]
  const [acomodacao, setAcomodacao] = useState(ACOMODACAO_PADRAO);
  const [valorAdicional, setValorAdicional] = useState('');
  const [emergencia, setEmergencia] = useState(false);
  const [buscaConsulta, setBuscaConsulta] = useState('');

  useEffect(() => {
    document.title = 'Codificação Anestésica — ANEST';
  }, []);

  const acomodacaoMult = useMemo(() => ACOMODACOES.find((a) => a.value === acomodacao)?.mult || 1, [acomodacao]);

  const addCodigo = (reg) =>
    setItens((prev) =>
      prev.some((i) => i.codigo === reg.codigo)
        ? prev
        : reaplicarAuto([...prev, { ...reg, quantidade: 1, percentual: 100, manual: false }])
    );
  const removeCodigo = (codigo) => setItens((prev) => reaplicarAuto(prev.filter((i) => i.codigo !== codigo)));
  const setQtd = (codigo, qtd) =>
    setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, quantidade: Math.max(1, qtd) } : i)));
  const setPercentual = (codigo, v) =>
    setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, percentual: v, manual: true } : i)));
  const limpar = () => setItens([]);
  const aplicarSugestao = () => setItens((prev) => reaplicarAuto(prev, true));

  const resultado = useMemo(() => {
    if (itens.length === 0) return null;
    return calcularGuia(
      itens.map((r) => ({ codigo: r.codigo, registro: r, quantidade: r.quantidade, percentual: r.percentual })),
      { tabela: 'local', valorAdicional: Number(valorAdicional) || 0, acomodacaoMult }
    );
  }, [itens, valorAdicional, acomodacaoMult]);

  const consultaFiltrada = useMemo(() => {
    const q = buscaConsulta.trim().toLowerCase();
    const grupos = q
      ? CODIGOS_POR_CATEGORIA.map((cat) => ({
          ...cat,
          codigos: cat.codigos.filter(
            (c) => c.codigo.includes(q) || c.descricao.toLowerCase().includes(q) || c.quandoUsar.toLowerCase().includes(q)
          ),
        })).filter((cat) => cat.codigos.length > 0)
      : CODIGOS_POR_CATEGORIA;
    return grupos;
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
                Digite o código TUSS ou o nome do procedimento. O % é preenchido automaticamente (maior = 100%, demais
                50%) e ajustável no badge de cada linha.
              </p>
              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Acomodação</span>
                <Select value={acomodacao} onChange={setAcomodacao} options={ACOMODACAO_OPTS} size="sm" />
                <p className="text-[11px] text-muted-foreground mt-2">
                  Tabela Unimed Chapecó · <span className="font-semibold text-foreground">UTM R$ 1,73</span>
                </p>
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {itens.length} procedimento{itens.length > 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-1">
                    {itens.length > 1 && (
                      <Button variant="ghost" size="sm" leftIcon={<Wand2 className="w-4 h-4" />} onClick={aplicarSugestao}>
                        Auto %
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={limpar}>
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {resultado.linhas.map((l) => (
                    <ResultadoLinha key={l.codigo} linha={l} onRemove={removeCodigo} onQtd={setQtd} onPercentual={setPercentual} />
                  ))}
                </div>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm text-muted-foreground">Valor adicional (R$)</label>
                    <Input
                      type="number"
                      min={0}
                      value={valorAdicional}
                      onChange={(e) => setValorAdicional(e.target.value)}
                      placeholder="0,00"
                      className="w-32 text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Eletiva / Emergência</span>
                    <Switch checked={emergencia} onChange={setEmergencia} label={emergencia ? 'Emergência' : 'Eletiva'} />
                  </div>
                </Card>

                <Card className="p-4 bg-primary/5">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Total rotulo="Cirurgião" valor={resultado.totais.totalCirurgiao} />
                    <Total rotulo="Anestesista" valor={resultado.totais.totalAnestesista} destaque />
                    <Total rotulo="Total geral" valor={resultado.totais.totalGeral} destaque />
                  </div>
                  {resultado.totais.totalRecomendado > 0 && (
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      + {formatarMoeda(resultado.totais.totalRecomendado)} potenciais se adicionados os códigos recomendados
                    </p>
                  )}
                </Card>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ⚠ Valores em UTM R$ 1,73 (Unimed Chapecó). Apartamento dobra o honorário. Os percentuais redutores
                  não constam do referencial (regra de auditoria); o auto-preenchimento (100%/50%) é ajustável por linha
                  e é estimativa de conferência — não substitui a auditoria da Unimed Executora.
                </p>
              </>
            )}
          </div>
        )}

        {activeTab === 'consulta' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-info/30 bg-info/5 p-3">
              <p className="text-[12px] text-foreground">
                <strong>Procedimento autorizado sem valor para anestesia?</strong> Use o código abaixo conforme a
                situação. Valores em UTM R$ 1,73.
              </p>
            </div>
            <Input
              value={buscaConsulta}
              onChange={(e) => setBuscaConsulta(e.target.value)}
              placeholder="Buscar por código, procedimento ou situação…"
            />

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
                      <ConsultaItem key={c.codigo} c={c} />
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
