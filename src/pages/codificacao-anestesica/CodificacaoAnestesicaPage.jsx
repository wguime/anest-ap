import { useEffect, useMemo, useState } from 'react';
import { Calculator, BookOpen, X, Trash2, Minus, Plus, Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Select,
  Input,
  EmptyState,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/design-system';
import { PageHeader } from '@/components';
import { calcularGuia, recomendarCodigo, gerarJustificativaCompleta } from '@/lib/codificacaoAnest';
import { OPCOES_PERCENTUAL, ACOMODACOES, ACOMODACAO_PADRAO, MULTIPLICADORES } from '@/lib/codificacaoAnestRules';
import { CODIGOS_POR_CATEGORIA, CODIGOS_ANESTESIA_MAP, SADT_EXAME_ANESTESIA, formatarMoeda } from '@/data/codigosAnestesia';
import { PROCEDIMENTOS_DOBRA } from '@/data/procedimentosDobra';
import { dobraAcomodacao, motivoNaoDobra, indicaSegundoAnestesista, INDICADOR_UTM } from '@/data/codificacaoAnestProtocolo';
import { searchCodigos } from '@/services/supabaseUnimedTussService';
import CodigoAutocomplete from './components/CodigoAutocomplete';
import JustificativaPronta from './components/JustificativaPronta';

const STATUS_META = {
  paga_embutida: { label: 'Anestesia paga', variant: 'success' },
  recomenda_codigo: { label: 'Adicionar código', variant: 'warning' },
  sem_anestesia: { label: 'Sem ato anestésico', variant: 'secondary' },
  sem_cobertura: { label: 'Sem cobertura', variant: 'destructive' },
  revisar: { label: 'Não encontrado', variant: 'secondary' },
};

const ACOMODACAO_OPTS = ACOMODACOES.map((a) => ({ value: a.value, label: a.label }));

// Por que um código não dobra em apartamento (item XIV / VIII).
const DOBRA_TEXTO = {
  sadt: 'Não dobra em apartamento: SADT/diagnóstico não dobra.',
  fora_lista: 'Não dobra em apartamento: código não consta na lista de procedimentos que dobram.',
};

const FATOR_LOCAL = MULTIPLICADORES.local / MULTIPLICADORES.intercambio;
// valores armazenados estão em intercâmbio (1,17); a Consulta exibe sempre local (1,75)
const valorLocal = (v, mult = 1) => (v == null ? null : Math.round(v * FATOR_LOCAL * mult * 100) / 100);

/** maior valor = 100% (Principal); demais = 50% (Mesma via). Só nas linhas não-manuais. */
function Info({ rotulo, valor }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="font-medium">{valor ?? '—'}</div>
    </div>
  );
}

function PercentualBadge({ value, onChange, tone = 'primary' }) {
  const triggerCls =
    tone === 'warning'
      ? 'flex items-center gap-1 rounded-full bg-warning/25 px-3 py-1 text-foreground font-bold tabular-nums'
      : 'flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary font-bold tabular-nums';
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          type="button"
          className={triggerCls}
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

/** Stepper de quantidade + badge de percentual (reutilizado no rodapé pago e no card recomendado). */
function QtdPctControls({ codigo, quantidade, pctValue, onQtd, onPct, tone = 'primary' }) {
  const warning = tone === 'warning';
  const stepBtn = warning
    ? 'border-warning/60 text-foreground hover:bg-warning/20'
    : 'border-border text-muted-foreground hover:bg-muted';
  const plusBtn = warning
    ? 'border-warning/60 text-foreground hover:bg-warning/20'
    : 'border-border text-primary hover:bg-primary/10';
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onQtd(codigo, quantidade - 1)}
          className={`w-8 h-8 rounded-full border flex items-center justify-center disabled:opacity-40 ${stepBtn}`}
          disabled={quantidade <= 1}
          aria-label="Diminuir quantidade"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-6 text-center font-semibold tabular-nums">{quantidade}</span>
        <button
          type="button"
          onClick={() => onQtd(codigo, quantidade + 1)}
          className={`w-8 h-8 rounded-full border flex items-center justify-center ${plusBtn}`}
          aria-label="Aumentar quantidade"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <PercentualBadge value={pctValue} onChange={(v) => onPct(codigo, v)} tone={tone} />
    </div>
  );
}

function ResultadoLinha({ linha, onRemove, onQtd, onPercentual, onRecPercentual }) {
  const recomenda = linha.statusAnestesia === 'recomenda_codigo';
  const [showJust, setShowJust] = useState(false);
  const meta = STATUS_META[linha.statusAnestesia] || STATUS_META.revisar;
  // Metadados em lista — só os campos preenchidos (evita "—" vazios).
  const detalhes = [
    linha.porteCirurgico && ['Porte cirúrgico', linha.porteCirurgico],
    linha.indicadorAnestesico && ['Indicador anestésico', `${linha.indicadorAnestesico}${linha.utmAnestesica != null ? ` · ${linha.utmAnestesica} UTM` : ''}`],
    linha.utmCirurgiao != null && ['UTM do procedimento', String(linha.utmCirurgiao)],
    linha.classificacao && ['Classificação', linha.classificacao],
  ].filter(Boolean);
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

      {linha.encontrado && (
        <>
          {detalhes.length > 0 && (
            <dl className="mt-3 rounded-lg bg-muted/30 px-3 text-[12px] divide-y divide-border/50">
              {detalhes.map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt className="text-muted-foreground shrink-0">{rotulo}</dt>
                  <dd className="font-semibold text-foreground text-right tabular-nums">{valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {linha.segundoAnestesista && (
            <p className="text-[11px] text-foreground mt-1.5 rounded-lg bg-muted/60 px-2 py-1.5">
              <span className="font-semibold">Cabível 2º anestesista</span> — auxiliar = 30% do titular. Exige justificativa técnica.
            </p>
          )}
          {linha.dobraAcomodacao && (
            <p className="text-[11px] text-muted-foreground mt-1">Apartamento: honorário dobrado.</p>
          )}
          {linha.motivoNaoDobra && (
            <p className="text-[11px] text-muted-foreground mt-1">{DOBRA_TEXTO[linha.motivoNaoDobra]}</p>
          )}
        </>
      )}

      <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-border/60 flex-wrap">
        {/* controles ficam no rodapé p/ linhas pagas; nas recomendadas migram p/ o card amarelo */}
        {recomenda ? <div /> : (
          <QtdPctControls codigo={linha.codigo} quantidade={linha.quantidade} pctValue={linha.percentual} onQtd={onQtd} onPct={onPercentual} />
        )}
        <div className="text-right">
          {linha.valorAnestesistaPago != null ? (
            <>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Anestesista</div>
              <div className="font-bold text-primary leading-tight">{formatarMoeda(linha.valorAnestesistaPago)}</div>
            </>
          ) : (
            <div className="text-[12px] font-medium text-warning">Não remunera anestesia</div>
          )}
          {linha.valorCirurgiaoPago != null && (
            <div className="text-[11px] text-muted-foreground mt-0.5">Cirurgião {formatarMoeda(linha.valorCirurgiaoPago)}</div>
          )}
        </div>
      </div>


      {linha.statusAnestesia === 'recomenda_codigo' && linha.recomendacao && (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="text-[12px] font-semibold text-foreground">
            Anestesia não remunerada neste código. Adicione:
          </p>
          {linha.limiteSadt && (
            <p className="text-[11px] text-foreground mt-1">
              ⚠ Além do limite de 3 procedimentos SADT diagnósticos — a anestesia deste não é remunerada.
            </p>
          )}
          {/* código em destaque (badge âmbar) no tamanho aumentado (15px) + descrição */}
          <div className="mt-1.5">
            <span className="inline-flex items-center rounded-lg bg-warning/25 text-foreground font-bold tabular-nums px-2.5 py-0.5 text-[15px]">{linha.recomendacao.principal.codigo}</span>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">{linha.recomendacao.principal.descricao}</p>
          </div>
          {linha.recomendacao.principal.indicador && (
            <dl className="mt-2 rounded-lg bg-card px-3 text-[12px]">
              <div className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="text-muted-foreground shrink-0">Indicador anestésico</dt>
                <dd className="font-semibold text-foreground text-right tabular-nums">
                  {linha.recomendacao.principal.indicador}
                  {INDICADOR_UTM[linha.recomendacao.principal.indicador] != null && ` · ${INDICADOR_UTM[linha.recomendacao.principal.indicador]} UTM`}
                </dd>
              </div>
            </dl>
          )}
          {linha.recomendacao.alternativa?.codigo && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Alternativa: {linha.recomendacao.alternativa.codigo} — {linha.recomendacao.alternativa.descricao}
            </p>
          )}
          {/* quantidade + percentual (cascata da anestesia) + valor — acima da justificativa */}
          <div className="flex items-end justify-between gap-3 mt-2 pt-2 border-t border-warning/30 flex-wrap">
            <QtdPctControls codigo={linha.codigo} quantidade={linha.quantidade} pctValue={linha.recPercentual} onQtd={onQtd} onPct={onRecPercentual} tone="warning" />
            {linha.recomendacao.principal.valor != null && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Anestesista</div>
                <div className="font-bold text-primary leading-tight">{formatarMoeda(linha.recomendacao.principal.valor)}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowJust((s) => !s)}
            className="mt-2 inline-flex items-center min-h-[36px] rounded-lg bg-warning/25 hover:bg-warning/35 text-foreground text-[12px] font-semibold px-3 py-1.5 border border-warning/60 transition-colors"
          >
            {showJust ? 'Ocultar justificativa' : 'Ver justificativa'}
          </button>
          {showJust && (
            <JustificativaPronta texto={gerarJustificativaCompleta({ procedimento: linha.descricao || '', recomendacao: linha.recomendacao })} />
          )}
        </div>
      )}

      {linha.statusAnestesia === 'sem_anestesia' && (
        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[12px] font-semibold text-muted-foreground">
            Procedimento sem ato anestésico
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pelo Protocolo Nacional (Instruções Gerais v2026.03, item 4.3.3), este procedimento
            não está vinculado ao ato anestésico em nenhuma hipótese — não há código 31602 a cobrar.
          </p>
        </div>
      )}
    </Card>
  );
}

function Secao({ titulo, children }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="text-[11px] uppercase tracking-wide font-bold text-foreground mb-1.5">{titulo}</div>
      {children}
    </div>
  );
}

/** Pill de valor no cabeçalho do accordion (estilo DocumentSection: bg-primary/10 text-primary). */
function PillValor({ valor, semValor }) {
  if (semValor)
    return (
      <span className="shrink-0 rounded-full bg-warning/15 text-foreground text-[11px] font-bold px-2.5 py-1">
        Sem valor
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-primary/10 text-primary text-sm font-bold px-2.5 py-1 tabular-nums">
      {formatarMoeda(valor)}
    </span>
  );
}

function TriggerCabecalho({ codigo, descricao, valor, semValor }) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="min-w-0 flex-1 text-left">
        <span className="font-bold tabular-nums">{codigo}</span>
        <p className="text-sm font-medium text-foreground leading-snug">{descricao}</p>
      </div>
      <PillValor valor={valor} semValor={semValor} />
    </div>
  );
}

/** Item da referência curada (códigos 31602): explicação + exemplos + indicador por extenso. */
function ConsultaItem({ c, mult = 1 }) {
  return (
    <AccordionItem value={c.codigo}>
      <AccordionTrigger className="px-4 min-h-[64px] py-3">
        <TriggerCabecalho codigo={c.codigo} descricao={c.descricao} valor={valorLocal(c.valor, mult)} />
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <Secao titulo="Quando usar">
          <p className="text-[13px] text-foreground leading-relaxed">{c.quandoUsar}</p>
        </Secao>
        {c.exemplos?.length > 0 && (
          <Secao titulo="Exemplos">
            <ul className="text-[13px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
              {c.exemplos.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </Secao>
        )}
        <Secao titulo="Detalhes">
          <p className="text-[13px] text-muted-foreground">
            Indicador anestésico: <span className="font-semibold text-foreground">{c.indicador}</span> · Valor:{' '}
            <span className="font-semibold text-primary">{formatarMoeda(valorLocal(c.valor, mult))}</span> (UTM 1,75)
          </p>
        </Secao>
      </AccordionContent>
    </AccordionItem>
  );
}

const MOTIVO_TEXTO = {
  exame: 'Sedação/anestesia necessária para a realização do exame/procedimento diagnóstico (item 4.3.1).',
  lista_312: 'Procedimento sem previsão de anestesia na tabela; sob ato anestésico justificado, cobra-se 31602312 (indicador A) — item 4.3.2.',
  diagnostico: 'Procedimento diagnóstico sem previsão de anestesia; sob ato justificado, indicador B em 31602304 (item 4.3.4).',
  imperativo: 'Procedimento terapêutico sem porte anestésico; sob imperativo clínico, indicador E em 31602355 (item 4.3.4).',
};

/** Resultado da busca no catálogo: paga anestesia OU mostra código substituto + justificativa. */
function ResultadoConsultaItem({ reg, mult = 1 }) {
  const pagaAnest = reg.indicadorAnestesico != null && reg.valorAnestesista != null;
  const rec = pagaAnest ? null : recomendarCodigo(reg);
  const sugeridoCurado = rec ? CODIGOS_ANESTESIA_MAP[rec.principal.codigo] : null;
  // Dobra de acomodação é por código (item XIV): SADT/não-listados não dobram (item VIII).
  const dobra = mult > 1 && dobraAcomodacao(reg.codigo, reg.lista) ? mult : 1;
  const utmAne = reg.indicadorAnestesico ? (INDICADOR_UTM[reg.indicadorAnestesico] ?? null) : null;
  const utmCir = reg.valorCirurgiao != null ? Math.round((reg.valorCirurgiao / 1.17) * 100) / 100 : null;
  const seg2 = indicaSegundoAnestesista(reg.descricao);
  const motivoND = mult > 1 ? motivoNaoDobra(reg.codigo, reg.lista) : null;
  return (
    <AccordionItem value={reg.codigo}>
      <AccordionTrigger className="px-4 min-h-[64px] py-3">
        <TriggerCabecalho codigo={reg.codigo} descricao={reg.descricao} valor={valorLocal(reg.valorAnestesista, dobra)} semValor={!pagaAnest} />
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="grid grid-cols-3 gap-2 mb-2 text-[12px]">
          <Info rotulo="Porte cir." valor={reg.porteCirurgico || '—'} />
          <Info rotulo="Ind. anest." valor={reg.indicadorAnestesico || '—'} />
          <Info rotulo="Classificação" valor={reg.classificacao || '—'} />
        </div>
        {(utmAne != null || utmCir != null) && (
          <p className="text-[11px] text-muted-foreground mb-2">
            UTM:
            {utmAne != null && <> anest. <span className="font-semibold text-foreground tabular-nums">{utmAne}</span></>}
            {utmAne != null && utmCir != null && ' ·'}
            {utmCir != null && <> proc. <span className="font-semibold text-foreground tabular-nums">{utmCir}</span></>}
          </p>
        )}
        {seg2 && (
          <p className="text-[11px] text-foreground mb-2 rounded-lg bg-muted/60 px-2 py-1.5">
            <span className="font-semibold">Cabível 2º anestesista</span> — auxiliar = 30% do titular (item 4.8). Exige justificativa técnica.
          </p>
        )}
        {dobra > 1 && <p className="text-[11px] text-muted-foreground mb-2">Apartamento: honorário dobrado (item XIV).</p>}
        {motivoND && <p className="text-[11px] text-muted-foreground mb-2">{DOBRA_TEXTO[motivoND]}</p>}
        {pagaAnest ? (
          <Secao titulo="Anestesia">
            <p className="text-[13px] text-foreground leading-relaxed">
              Este código já remunera a anestesia — Indicador anestésico:{' '}
              <span className="font-semibold">{reg.indicadorAnestesico}</span> · Valor:{' '}
              <span className="font-semibold text-primary">{formatarMoeda(valorLocal(reg.valorAnestesista, dobra))}</span> (UTM 1,75).
              Fature como anestesista neste mesmo código.
            </p>
          </Secao>
        ) : !rec ? (
          <Secao titulo="Sem ato anestésico">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Pelo Protocolo Nacional (Instruções Gerais v2026.03, item 4.3.3), este procedimento
              não está vinculado ao ato anestésico em nenhuma hipótese — não há código 31602 a cobrar.
            </p>
          </Secao>
        ) : (
          <>
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-3">
              <p className="text-[12px] font-semibold text-foreground mb-1">
                Para a anestesia ser paga, registre o código:
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="warning">{rec.principal.codigo}</Badge>
                <span className="text-sm">{rec.principal.descricao}</span>
                {rec.principal.valor != null && (
                  <span className="text-sm font-semibold text-primary">{formatarMoeda(valorLocal(rec.principal.valor, dobra))}</span>
                )}
              </div>
              {rec.alternativa?.codigo && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Alternativa: {rec.alternativa.codigo} — {rec.alternativa.descricao}
                </p>
              )}
            </div>
            <Secao titulo="Justificativa">
              <p className="text-[13px] text-muted-foreground leading-relaxed">{MOTIVO_TEXTO[rec.motivo]}</p>
            </Secao>
            {sugeridoCurado?.exemplos?.length > 0 && (
              <Secao titulo="Exemplos">
                <ul className="text-[13px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
                  {sugeridoCurado.exemplos.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </Secao>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function Total({ rotulo, valor, destaque }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={`font-bold ${destaque ? 'text-primary text-lg' : ''}`}>{formatarMoeda(valor)}</div>
    </div>
  );
}

export default function CodificacaoAnestesicaPage({ goBack }) {
  const [activeTab, setActiveTab] = useState('calculadora');
  const [itens, setItens] = useState([]); // [{...registro, quantidade, percentual, manual}]
  const [acomodacao, setAcomodacao] = useState(ACOMODACAO_PADRAO);
  const [urgencia, setUrgencia] = useState(false);
  const [buscaConsulta, setBuscaConsulta] = useState('');

  useEffect(() => {
    document.title = 'Codificação Anestésica — ANEST';
  }, []);

  const acomodacaoMult = useMemo(() => ACOMODACOES.find((a) => a.value === acomodacao)?.mult || 1, [acomodacao]);

  // Cada código entra a 100%; o % é ajustado manualmente pelo badge (sem preenchimento automático).
  const addCodigo = (reg) =>
    setItens((prev) =>
      prev.some((i) => i.codigo === reg.codigo) ? prev : [...prev, { ...reg, quantidade: 1, percentual: 100, recPercentual: 100 }]
    );
  const removeCodigo = (codigo) => setItens((prev) => prev.filter((i) => i.codigo !== codigo));
  const setQtd = (codigo, qtd) =>
    setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, quantidade: Math.max(1, qtd) } : i)));
  const setPercentual = (codigo, v) =>
    setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, percentual: v } : i)));
  const setRecPercentual = (codigo, v) =>
    setItens((prev) => prev.map((i) => (i.codigo === codigo ? { ...i, recPercentual: v } : i)));
  const limpar = () => setItens([]);

  const resultado = useMemo(() => {
    if (itens.length === 0) return null;
    return calcularGuia(
      itens.map((r) => ({ codigo: r.codigo, registro: r, quantidade: r.quantidade, percentual: r.percentual, recPercentual: r.recPercentual })),
      { tabela: 'local', acomodacaoMult, urgencia }
    );
  }, [itens, acomodacaoMult, urgencia]);

  // Busca no catálogo completo (código OU nome) — RPC acento-insensível, com debounce.
  const [resultados, setResultados] = useState([]);
  const [buscandoConsulta, setBuscandoConsulta] = useState(false);
  const buscaAtiva = buscaConsulta.trim().length >= 2;
  useEffect(() => {
    if (!buscaAtiva) {
      setResultados([]);
      setBuscandoConsulta(false);
      return;
    }
    setBuscandoConsulta(true);
    const id = setTimeout(async () => {
      try {
        setResultados(await searchCodigos(buscaConsulta, 30));
      } catch {
        setResultados([]);
      } finally {
        setBuscandoConsulta(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [buscaConsulta, buscaAtiva]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader title="Codificação Anestésica" subtitle="Cobrança e códigos Unimed" onBack={goBack} />

      <div className="px-4 sm:px-5 lg:px-6 xl:px-8 py-4 max-w-3xl mx-auto">
        {/* Seletor segmentado (mesmo estilo do Cateter Peridural) */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { value: 'calculadora', label: 'Calculadora', Icon: Calculator },
            { value: 'consulta', label: 'Consulta', Icon: BookOpen },
          ].map(({ value, label, Icon }) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                aria-pressed={active}
                className={`py-3 px-4 min-h-[44px] rounded-[16px] border text-sm font-medium transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${
                  active
                    ? 'border-[hsl(var(--primary-hover))] bg-primary/10 text-primary dark:border-[hsl(var(--primary))] dark:bg-primary/20'
                    : 'border-[hsl(var(--input))] bg-card text-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>

        {activeTab === 'calculadora' && (
          <div className="space-y-4">
            <Card className="p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                Adicione os códigos autorizados
              </label>
              <CodigoAutocomplete onAdd={addCodigo} jaAdicionados={itens.map((i) => i.codigo)} />
              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Acomodação</span>
                <Select value={acomodacao} onChange={setAcomodacao} options={ACOMODACAO_OPTS} size="sm" />
                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={urgencia}
                    onChange={(e) => setUrgencia(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                  />
                  <span className="text-[12px] text-foreground leading-snug">
                    Urgência/emergência <span className="font-semibold">+30%</span>
                    <span className="block text-[11px] text-muted-foreground mt-1">
                      +30% sobre o honorário (cirurgião e anestesista) quando:
                    </span>
                    <ul className="text-[11px] text-muted-foreground list-disc pl-4 mt-0.5 space-y-0.5">
                      <li>entre <b className="text-foreground font-medium">19h e 7h</b>, ou em sábados, domingos e feriados;</li>
                      <li>apenas atos <b className="text-foreground font-medium">não-eletivos</b> (cirurgia programada, visita a internado e plantão de UTI não contam);</li>
                      <li><b className="text-foreground font-medium">não</b> incide sobre SADT.</li>
                    </ul>
                  </span>
                </label>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Tabela Unimed Chapecó · <span className="font-semibold text-foreground">UTM R$ 1,75</span>
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
                  <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={limpar}>
                    Limpar
                  </Button>
                </div>

                <div className="space-y-3">
                  {resultado.linhas.map((l) => (
                    <ResultadoLinha key={l.codigo} linha={l} onRemove={removeCodigo} onQtd={setQtd} onPercentual={setPercentual} onRecPercentual={setRecPercentual} />
                  ))}
                </div>

                <Card className="p-4 bg-primary/5">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Total rotulo="Anestesista" valor={resultado.totais.totalAnestesista} destaque />
                    <Total rotulo="Cirurgião" valor={resultado.totais.totalCirurgiao} />
                    <Total rotulo="Total geral" valor={resultado.totais.totalGeral} destaque />
                  </div>
                  {resultado.totais.totalRecomendado > 0 && (
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      + {formatarMoeda(resultado.totais.totalRecomendado)} potenciais se adicionados os códigos recomendados
                    </p>
                  )}
                </Card>

                {/* Como funciona + significado da classificação */}
                <div className="rounded-xl border border-border bg-card p-3 text-[12px] space-y-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Como a guia é calculada
                  </div>

                  <div>
                    <div className="font-semibold text-foreground">Procedimentos múltiplos</div>
                    <p className="text-muted-foreground leading-snug mt-0.5">
                      Por ordem decrescente de valor: 1º 100%, 2º 50% (mesma via) ou 70% (outra via), 3º 40%, 4º 30%, 5º+ 10%. Ajuste o % de cada linha no badge.
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-foreground">Apartamento (dobra)</div>
                    <p className="text-muted-foreground leading-snug mt-0.5">
                      Dobra o honorário só dos cirúrgicos (3xxx) e de procedimentos específicos das tabelas 1/2/4. SADT e demais não dobram.
                    </p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-primary font-medium select-none">
                        Ver os {PROCEDIMENTOS_DOBRA.length} procedimentos que dobram (tabelas 1/2/4)
                      </summary>
                      <div className="mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-border divide-y divide-border/50">
                        {PROCEDIMENTOS_DOBRA.map((p) => (
                          <div key={p.codigo} className="flex gap-2.5 px-3 py-2 leading-snug">
                            <span className="font-semibold text-foreground tabular-nums shrink-0 w-[66px]">{p.codigo}</span>
                            <span className="text-muted-foreground">{p.descricao}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>

                  <div>
                    <div className="font-semibold text-foreground">Quando o código não paga anestesia, registre:</div>
                    <ul className="text-muted-foreground leading-snug mt-0.5 list-disc pl-4 space-y-0.5">
                      <li><b className="text-foreground">Exame de imagem/endoscopia</b>: o código daquele exame (RM→31602282, TC→31602274, US→31602266, endoscopia→31602231/240…).</li>
                      <li>Procedimento da <b className="text-foreground">lista oficial</b>: o <b className="text-foreground">31602312</b>.</li>
                      <li><b className="text-foreground">Demais</b>: <b className="text-foreground">31602304</b> se diagnóstico, ou <b className="text-foreground">31602355</b> se terapêutico.</li>
                      <li>Procedimentos que <b className="text-foreground">nunca têm anestesia</b>: o app mostra "sem ato anestésico".</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-border/60 space-y-1">
                    <p className="leading-snug">
                      <span className="font-semibold text-foreground">Racionalização:</span>{' '}
                      <span className="text-muted-foreground">exige autorização prévia e documentação — passa por auditoria médica antes do pagamento.</span>
                    </p>
                    <p className="leading-snug">
                      <span className="font-semibold text-foreground">Baixo Risco:</span>{' '}
                      <span className="text-muted-foreground">liberação imediata, sem documentação adicional.</span>
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ⚠ Valores em UTM R$ 1,75 (Unimed Chapecó). Conferência — não substitui a auditoria da Unimed Executora.
                </p>
              </>
            )}
          </div>
        )}

        {activeTab === 'consulta' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-accent dark:bg-card dark:border dark:border-border p-3">
              <p className="text-[12px] text-foreground">
                <strong>Busque o procedimento autorizado</strong> (código ou nome). Se ele não pagar anestesia, mostramos
                o código a registrar para receber. Toque num item para ver explicação e exemplos. Valores em UTM R$ 1,75.
              </p>
            </div>
            <div className="relative">
              <Input
                value={buscaConsulta}
                onChange={(e) => setBuscaConsulta(e.target.value)}
                placeholder="Buscar procedimento por código ou nome…"
              />
              {buscandoConsulta && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Acomodação</span>
              <Select value={acomodacao} onChange={setAcomodacao} options={ACOMODACAO_OPTS} size="sm" />
              {acomodacaoMult > 1 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Apartamento — dobra apenas os códigos elegíveis (cirúrgicos e procedimentos listados; SADT não dobra).
                </p>
              )}
            </div>

            {buscaAtiva ? (
              resultados.length === 0 ? (
                <EmptyState title={buscandoConsulta ? 'Buscando…' : 'Nada encontrado'} description="Tente outro código ou nome." />
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <Accordion type="multiple">
                    {resultados.map((reg) => (
                      <ResultadoConsultaItem key={reg.codigo} reg={reg} mult={acomodacaoMult} />
                    ))}
                  </Accordion>
                </div>
              )
            ) : (
              <>
                <section>
                  <div className="mb-2 mt-1 px-1">
                    <h3 className="text-[17px] font-bold text-foreground leading-tight tracking-tight">Procedimentos SADT — qual anestesia cobrar</h3>
                    <ul className="text-[13px] text-muted-foreground mt-1 list-disc pl-4 space-y-1 leading-snug">
                      <li>Exames SADT não pagam anestesia embutida — o anestesista lança um destes códigos conforme o tipo de exame.</li>
                      <li>Anestesia para SADT exclusivamente diagnóstico: paga em <b className="text-foreground">até 3 procedimentos</b>.</li>
                      <li>Esses valores <b className="text-foreground">não dobram em apartamento</b>.</li>
                      <li>Toque num item para ver quando usar, exemplos e detalhe. Valores em UTM R$ 1,75.</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <Accordion type="multiple">
                      {SADT_EXAME_ANESTESIA.map((e) => (
                        <ConsultaItem key={e.codigo} c={e} mult={acomodacaoMult} />
                      ))}
                    </Accordion>
                  </div>
                </section>

                <p className="text-[12px] text-muted-foreground">
                  Ou consulte os códigos que o anestesista fatura diretamente, por situação:
                </p>
                {CODIGOS_POR_CATEGORIA.filter((cat) => cat.categoria !== 'anestesia_exame').map((cat) => (
                  <section key={cat.categoria}>
                    <div className="mb-2 mt-1 px-1">
                      <h3 className="text-[17px] font-bold text-foreground leading-tight tracking-tight">{cat.label}</h3>
                      <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{cat.descricao}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <Accordion type="multiple">
                        {cat.codigos.map((c) => (
                          <ConsultaItem key={c.codigo} c={c} mult={acomodacaoMult} />
                        ))}
                      </Accordion>
                    </div>
                  </section>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
