import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { numeroBr } from '../../../lib/numeroBr';
import { useUser } from '@/contexts/UserContext';
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas';
import { useCalculadoraHeader } from '@/contexts/CalculadoraHeaderContext';
import {
  transferirBalanco,
  buscarTransferenciaPendente,
  assumirTransferencia,
  recusarTransferencia,
} from '@/services/balancoTransferenciaService';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import {
  Droplets,
  ChevronRight,
  ArrowDownToLine,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  CalendarClock,
  TrendingDown,
  User,
  Baby,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import {
  evaluateBalance,
  fastingDeficit,
  maintenanceRate,
  furmanReplacement,
  categoryForPopulation,
  medido,
} from '../../../lib/fluidBalance';
import { pesosDeReferencia } from '../../../lib/pesoCorporal';
import {
  inicioProcedimento,
  camposDoInstante,
  dataCurta,
  horaCurta,
  rotuloHora,
  faixaHora,
  tempoDecorrido,
  horaDoRelogio,
} from '../../../lib/tempoProcedimento';

/* ⚠️ O rótulo do Select ficava truncado no gatilho ("Médio porte (4 ml/kg/h) —
   colecistect...", relatado pelo dono): o dropdown do DS herda a largura do
   gatilho. Por isso o rótulo é CURTO e os exemplos vivem embaixo do campo, onde
   cabem — e onde dá para listar muitos. */
/* ⚠️ Rótulo CURTO: com a grade em duas colunas o gatilho do Select tem meia
   largura (~165px a 375px), e o dropdown do DS herda a largura do gatilho. O
   nome por extenso vive no título do bloco de exemplos, logo abaixo. */
const PORTE_OPTIONS = [
  { value: 'pequeno', label: 'Pequeno — 2 ml/kg/h', nome: 'pequeno porte' },
  { value: 'medio', label: 'Médio — 4 ml/kg/h', nome: 'médio porte' },
  { value: 'grande', label: 'Grande — 6 ml/kg/h', nome: 'grande porte' },
];

const PORTE_EXEMPLOS = {
  pequeno: {
    exemplos:
      'Herniorrafia · ortopedia menor e artroscopia · cirurgia de mama · tireoidectomia · ' +
      'oftalmológica · RTU de próstata ou bexiga · videolaparoscopia diagnóstica · ' +
      'histeroscopia · cirurgia de pele e partes moles',
  },
  medio: {
    exemplos:
      'Colecistectomia · apendicectomia · histerectomia · nefrectomia · artroplastia de quadril ou joelho · ' +
      'bariátrica laparoscópica · coluna 1–2 níveis · ' +
      'ROBÓTICAS: prostatectomia radical, histerectomia, miomectomia, nefrectomia parcial, ' +
      'colectomia, hernioplastia ventral',
    nota:
      'Nas robóticas com Trendelenburg acentuado, o volume costuma ser RESTRITO durante o console — ' +
      'diurese baixa mantém o campo seco até a anastomose, e o excesso vira edema de face e via aérea. ' +
      'Oligúria nesse período é esperada; reavaliar depois de desfeito o pneumoperitônio.',
  },
  grande: {
    exemplos:
      'Laparotomia exploradora · toracotomia · esofagectomia · duodenopancreatectomia · ' +
      'ressecção hepática · cirurgia de aorta · cistectomia radical com derivação · ' +
      'citorredução com HIPEC · coluna longa · politrauma · ' +
      'ROBÓTICAS: esofagectomia, cistectomia radical, duodenopancreatectomia, lobectomia pulmonar',
  },
};

const SEXO_OPTIONS = [
  { v: 'masculino', label: 'Homem' },
  { v: 'feminino', label: 'Mulher' },
];

const PED_CATEGORY_OPTIONS = [
  { value: 'prematuro', label: 'Prematuro (95 ml/kg)' },
  { value: 'neonato', label: 'Neonato 0-30 dias (85 ml/kg)' },
  { value: 'lactente', label: 'Lactente 1-12 meses (80 ml/kg)' },
  { value: 'crianca', label: 'Criança 1-12 anos (75 ml/kg)' },
];

/* ⚠️ O caso em andamento sobrevive à recarga.
 *
 * O estado era `useState` puro e nada o salvava: numa cirurgia de 6 h, as 12
 * horas digitadas sumiam em qualquer recarga — e todo deploy renomeia os
 * chunks e força recarga (docs/deploy-e-ci.md). Só números entram aqui; nada
 * que identifique o paciente. */
const CHAVE_RASCUNHO = 'anest-bh-transop-rascunho';

function lerRascunho() {
  try {
    const cru = localStorage.getItem(CHAVE_RASCUNHO);
    if (!cru) return null;
    const d = JSON.parse(cru);
    return d && Array.isArray(d.horas) ? d : null;
  } catch {
    return null;
  }
}

function makeHoraId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `h-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function emptyHora() {
  return {
    id: makeHoraId(),
    cristaloide: '',
    coloide: '',
    sangueDerivados: '',
    sangramento: '',
    diurese: '',
    outras: '',
  };
}

function PillToggle({ value, onChange }) {
  const opts = [
    { v: 'adulto', label: 'Adulto', icon: User },
    { v: 'pediatrico', label: 'Pediátrico', icon: Baby },
  ];
  return (
    <div
      role="tablist"
      aria-label="População"
      className="inline-flex p-1 rounded-xl bg-muted border border-border"
    >
      {opts.map(({ v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              active
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Resumo curto de um payload recebido — mesma leitura do card do paciente. */
function resumoDoPayload(payload) {
  const s = payload?.sexo;
  return [
    s === 'masculino' ? 'homem' : s === 'feminino' ? 'mulher' : null,
    payload?.idade && `${payload.idade}a`,
    payload?.peso && `${payload.peso} kg`,
    payload?.altura && `${numeroBr(Number(payload.altura) / 100, 2)} m`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function SexoToggle({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="Sexo biológico"
      className="inline-flex p-1 rounded-xl bg-muted border border-border"
    >
      {SEXO_OPTIONS.map(({ v, label }) => {
        const ativo = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={ativo}
            // Clicar no que já está selecionado LIMPA: sem isso não há como
            // voltar para "não informado", que é o estado em que o card usa
            // 70 ml/kg — a média, e o comportamento de antes de 31/08.
            onClick={() => onChange(ativo ? '' : v)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              ativo ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, unit, detalhe, accent = 'default' }) {
  /* ⚠️ O amarelo saiu do TEXTO. `text-warning` sobre `bg-warning/10` mede
     1,99:1 contra os 4,5:1 do WCAG AA (.claude/rules/design-tokens.md) — o
     dono viu como "texto amarelo fora do DS". O sinal semântico continua no
     FUNDO e na BORDA, que não precisam passar em contraste de texto; quem
     carrega a leitura é o `foreground`. */
  const accentClass = {
    default: 'bg-muted border-border',
    warning: 'bg-warning/10 border-warning/50',
    destructive: 'bg-destructive/10 border-destructive/50',
    /* ⚠️ `bg-primary/10` NÃO serve de destaque no claro: --primary é #004225,
       e 10% dele sobre branco fica MAIS apagado que o --muted (#E8F5E9) dos
       cartões comuns — o realce lia como o mais fraco da fileira. `accent`
       (#D4EDDA) é a receita do DS para destacar sem virar alerta; no escuro
       accent ≈ card, então lá quem destaca é a BORDA. */
    primary: 'bg-accent border-primary/40 dark:bg-card dark:border-primary/50',
  }[accent];

  return (
    /* ⚠️ `h-full` + `mt-auto`: quando um rótulo quebra em duas linhas e o
       vizinho não, o número descia e a fileira ficava torta (dono 31/08).
       Ancorando valor e unidade na BASE, todos alinham em qualquer rótulo. */
    <div className={cn('h-full flex flex-col px-2.5 py-2 rounded-xl border text-center', accentClass)}>
      {/* `tracking-wide` e não `wider`: com 3 colunas a 375px cada cartão tem
          ~82px úteis e "AJUSTADO" estourava por 4px. */}
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </p>
      <div className="mt-auto pt-1">
        {/* ⚠️ Unidade À DIREITA do número, na mesma linha (dono 01/09): embaixo
            ela custava uma linha inteira por cartão. O que sobra — a leitura
            que conversa com as horas — vai para `detalhe`, e só aparece quando
            existe, então cartão sem detalhe tem DUAS linhas em vez de três. */}
        <p className="leading-none text-foreground">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
        </p>
        {detalhe && (
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{detalhe}</p>
        )}
      </div>
    </div>
  );
}

/** Diurese hora a hora — é a série que a aba, sozinha, faria desaparecer. */
function SerieDiurese({ diureses, meta, ativa }) {
  const valores = diureses.filter((d) => d !== null);
  if (valores.length === 0) return null;
  const max = Math.max(meta, ...valores);

  return (
    <div>
      <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
        {diureses.map((d, i) => {
          const altura = d === null ? 3 : Math.max(3, Math.round((d / max) * 32));
          return (
            <div
              key={i}
              style={{ height: `${altura}px` }}
              className={cn(
                'flex-1 rounded-t-[3px] min-h-[3px]',
                d === null && 'bg-border',
                d !== null && d < meta && 'bg-warning',
                d !== null && d >= meta && (i === ativa ? 'bg-primary' : 'bg-primary/40')
              )}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>Diurese h1</span>
        <span>meta {numeroBr(meta)} ml/h</span>
        <span>h{diureses.length}</span>
      </div>
      <p className="sr-only">
        Diurese por hora, em ml:{' '}
        {diureses.map((d, i) => `hora ${i + 1}: ${d === null ? 'não medida' : numeroBr(d)}`).join('; ')}.
      </p>
    </div>
  );
}

/** Livro-razão: entrada, saída e saldo corrido de cada hora. */
function LivroRazao({ horas, rate, tsLoss, meta, inicio }) {
  // Saldo corrido pré-calculado: acumular dentro do `map` do JSX é mutação
  // depois do render e o ESLint (react-hooks/immutability) reprova.
  const linhas = horas.reduce((acc, h) => {
    const entrada =
      (medido(h.cristaloide) ?? 0) + (medido(h.coloide) ?? 0) + (medido(h.sangueDerivados) ?? 0);
    const saida =
      (medido(h.sangramento) ?? 0) + (medido(h.diurese) ?? 0) + (medido(h.outras) ?? 0) + rate + tsLoss;
    const anterior = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
    acc.push({ id: h.id, entrada, saida, acumulado: anterior + entrada - saida, diurese: medido(h.diurese) });
    return acc;
  }, []);

  /* A coluna da hora abre de 38 para 50px quando há relógio — é o que faz
     "07:30" caber embaixo do "h1" sem espremer entrada, saída e saldo. */
  const grade = inicio
    ? 'grid grid-cols-[50px_1fr_1fr_72px] gap-1.5'
    : 'grid grid-cols-[38px_1fr_1fr_72px] gap-1.5';

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className={cn(grade, 'px-2.5 py-1.5 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground')}>
        <span>h</span>
        <span>entrada</span>
        <span>saída</span>
        <span className="text-right">saldo</span>
      </div>
      {linhas.map((l, i) => (
        <div
          key={l.id}
          className={cn(grade, 'px-2.5 py-2 text-[13px] tabular-nums border-t border-border')}
        >
          <span data-testid="livro-hora" className="font-bold text-primary leading-tight">
            {`h${i + 1}`}
            {inicio && (
              <span className="block text-[10px] font-semibold text-muted-foreground">
                {rotuloHora(inicio, i + 1)}
              </span>
            )}
          </span>
          <span>{numeroBr(l.entrada)}</span>
          <span className={cn(l.diurese !== null && l.diurese < meta && 'font-bold text-foreground')}>
            {numeroBr(l.saida)}
          </span>
          <span className={cn('text-right font-bold', l.acumulado < 0 && 'text-destructive')}>
            {l.acumulado >= 0 ? '+' : ''}
            {numeroBr(l.acumulado)}
          </span>
        </div>
      ))}
    </div>
  );
}

function HoraCampos({ hora, onChange }) {
  const set = (key) => (e) => {
    const val = e?.target?.value ?? e;
    onChange({ ...hora, [key]: val });
  };

  return (
    <div data-testid="hora-campos" className="grid grid-cols-2 gap-2">
      <Input type="number" label="Cristaloide (ml)" value={hora.cristaloide} onChange={set('cristaloide')} min={0} placeholder="0" />
      <Input type="number" label="Coloide (ml)" value={hora.coloide} onChange={set('coloide')} min={0} placeholder="0" />
      <Input type="number" label="Sangue/Hemod. (ml)" value={hora.sangueDerivados} onChange={set('sangueDerivados')} min={0} placeholder="0" />
      <Input type="number" label="Sangramento (ml)" value={hora.sangramento} onChange={set('sangramento')} min={0} placeholder="0" />
      <Input type="number" label="Diurese (ml)" value={hora.diurese} onChange={set('diurese')} min={0} placeholder="não medida" />
      <Input type="number" label="Outras saídas (ml)" value={hora.outras} onChange={set('outras')} min={0} placeholder="0" />
    </div>
  );
}

export default function BalancoHidricoTransopDisplay() {
  const salvo = useMemo(() => lerRascunho(), []);

  const [populacao, setPopulacao] = useState(salvo?.populacao ?? 'adulto');
  const [pedCategory, setPedCategory] = useState(salvo?.pedCategory ?? 'crianca');
  const [peso, setPeso] = useState(salvo?.peso ?? '');
  const [npoHoras, setNpoHoras] = useState(salvo?.npoHoras ?? '');
  const [porte, setPorte] = useState(salvo?.porte ?? 'medio');
  const [hctInicial, setHctInicial] = useState(salvo?.hctInicial ?? '');
  const [hctMinimo, setHctMinimo] = useState(salvo?.hctMinimo ?? '25');
  const [sexo, setSexo] = useState(salvo?.sexo ?? '');
  const [altura, setAltura] = useState(salvo?.altura ?? '');
  const [idade, setIdade] = useState(salvo?.idade ?? '');
  const [creatinina, setCreatinina] = useState(salvo?.creatinina ?? '');
  const [horas, setHoras] = useState(salvo?.horas ?? []);
  const [horaAtiva, setHoraAtiva] = useState(Math.max(0, (salvo?.horas?.length ?? 1) - 1));
  const [verLivro, setVerLivro] = useState(false);
  /* ── Relógio do procedimento ───────────────────────────────────────────
     Data e hora de início ancoram a série: sem elas a fita é "1 2 3", com elas
     cada aba ganha o horário real da sala e o card conta o tempo corrido. Só
     data e hora do CASO — nada que identifique o paciente. */
  const [inicioData, setInicioData] = useState(salvo?.inicioData ?? '');
  const [inicioHora, setInicioHora] = useState(salvo?.inicioHora ?? '');
  const [inicioAberto, setInicioAberto] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  /* `null` = automático: aberto enquanto não há peso, recolhido depois. Um
     clique fixa a escolha e ela passa a valer sobre o automático. */
  const [pacienteAberto, setPacienteAberto] = useState(null);

  /* ── Transferência para um colega ──────────────────────────────────────
     Entrega, não sincronia: quem passa envia e perde o registro; quem recebe
     assume. Sem edição simultânea não há conflito (dono 01/09). */
  const { user } = useUser();
  const { options: colegas } = useRosterAnestesistas();
  const { registrarAcao, registrarAcaoTitulo } = useCalculadoraHeader();
  const [transferindo, setTransferindo] = useState(false);
  const [colegaId, setColegaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroTransf, setErroTransf] = useState('');
  const [recebida, setRecebida] = useState(null);
  const fitaRef = useRef(null);

  const isPediatric = populacao === 'pediatrico';
  const category = isPediatric ? pedCategory : categoryForPopulation('adulto');
  const pesoN = parseFloat(peso) || 0;
  const npoN = parseFloat(npoHoras) || 0;
  const hctIN = parseFloat(hctInicial) || 0;
  const hctMN = parseFloat(hctMinimo) || 0;
  const alturaN = parseFloat(altura) || 0;
  const idadeN = parseFloat(idade) || 0;
  const creatininaN = parseFloat(creatinina) || 0;

  // O rascunho é gravado a cada mudança; recarregar não perde a cirurgia.
  useEffect(() => {
    try {
      localStorage.setItem(
        CHAVE_RASCUNHO,
        JSON.stringify({
          populacao, pedCategory, peso, npoHoras, porte, hctInicial, hctMinimo, horas,
          sexo, altura, idade, creatinina, inicioData, inicioHora,
        })
      );
    } catch {
      /* modo privado ou armazenamento cheio: seguir sem persistir */
    }
  }, [populacao, pedCategory, peso, npoHoras, porte, hctInicial, hctMinimo, horas,
      sexo, altura, idade, creatinina, inicioData, inicioHora]);

  /* A fita mostra a hora ATIVA, não a hora 1. Com 12 horas a aba em uso nasce
   * fora de vista, e quem recarrega no meio da cirurgia não acha onde digitar.
   * Ajustado no container em vez de `scrollIntoView`, que arrastaria a PÁGINA
   * inteira junto e faria a tela pular. */
  useEffect(() => {
    const ajustar = () => {
      const fita = fitaRef.current;
      if (!fita || fita.clientWidth === 0) return;
      const alvo = fita.querySelector('[aria-selected="true"]');
      if (!alvo) return;
      // ⚠️ por RECT, não por `offsetLeft`: o offsetParent da fita é o BODY (ela
      // não é posicionada), então offsetLeft carrega junto o deslocamento da
      // coluna e a conta só acertava na última hora, por saturar no máximo.
      const caixa = fita.getBoundingClientRect();
      const aba = alvo.getBoundingClientRect();
      fita.scrollLeft += aba.left + aba.width / 2 - (caixa.left + caixa.width / 2);
    };
    // Num quadro depois: em pé o efeito pegava a largura final, mas DEITADO o
    // grid de duas colunas ainda não tinha assentado e a conta saía com a
    // largura errada — medido, a aba ativa nascia fora de vista.
    const quadro = requestAnimationFrame(ajustar);
    // `resize` chega DEPOIS de a viewport virar; `orientationchange` do iOS
    // chega antes e é a armadilha registrada no tailwind.config.js.
    window.addEventListener('resize', ajustar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', ajustar);
    };
  }, [horaAtiva, horas.length]);

  const result = useMemo(
    () =>
      evaluateBalance({
        weightKg: pesoN,
        npoHours: npoN,
        porte,
        category,
        hctInicial: hctIN,
        hctMinimo: hctMN,
        isPediatric,
        hours: horas,
        alturaCm: alturaN,
        sexo,
        idadeAnos: idadeN,
        creatinina: creatininaN,
      }),
    [pesoN, npoN, porte, category, hctIN, hctMN, isPediatric, horas,
     alturaN, sexo, idadeN, creatininaN]
  );

  const deficit = useMemo(() => fastingDeficit(pesoN, npoN), [pesoN, npoN]);
  /* Peso ideal / magro / ajustado saem da lib compartilhada `pesoCorporal.js`
   * (criada em 30/08). O card já dizia "em obesidade, prefira peso ideal ou
   * magro ao peso real" e não oferecia onde calcular — o conselho ficava sem
   * destino. Precisa de altura E sexo. */
  const pesos = useMemo(
    () => (alturaN > 0 && sexo ? pesosDeReferencia(pesoN, alturaN, sexo) : null),
    [pesoN, alturaN, sexo]
  );
  const furman1 = useMemo(() => furmanReplacement(pesoN, npoN, 1), [pesoN, npoN]);
  const furman2 = useMemo(() => furmanReplacement(pesoN, npoN, 2), [pesoN, npoN]);
  const furman3 = useMemo(() => furmanReplacement(pesoN, npoN, 3), [pesoN, npoN]);

  const hasPreop = pesoN > 0;
  const temHoras = horas.length > 0;
  const indiceAtivo = Math.min(horaAtiva, Math.max(0, horas.length - 1));

  const inicio = useMemo(
    () => inicioProcedimento(inicioData, inicioHora),
    [inicioData, inicioHora]
  );
  const corrido = inicio ? tempoDecorrido(inicio, agora) : null;
  /* O relógio passou do fim da última hora lançada e não há onde digitar o que
     está entrando AGORA. Vira um convite de um toque — nunca uma hora criada
     sozinha: hora em branco no meio da série entraria na conta como se tivesse
     sido medida (manutenção e terceiro espaço contam por hora registrada). */
  const horaDoRelogioAgora = inicio ? horaDoRelogio(inicio, agora) : 0;
  const precisaAbrirHora = horaDoRelogioAgora > horas.length && horas.length > 0;

  /* Um tique por minuto, e só enquanto há relógio para mexer: é o que mantém o
     tempo corrido e o aviso de virada vivos sem redesenhar a tela à toa. */
  useEffect(() => {
    if (!inicio || horas.length === 0) return undefined;
    const id = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(id);
  }, [inicio, horas.length]);

  const addHora = useCallback(() => {
    /* A 1ª hora chega junto com o "agora": é o instante em que se começa a
       lançar, e quem começou antes corrige a hora ali mesmo — dois toques em
       vez de um formulário em branco. */
    const sugerido = camposDoInstante();
    setInicioData((d) => d || sugerido.data);
    setInicioHora((h) => h || sugerido.hora);
    setHoras((arr) => {
      const proximo = [...arr, emptyHora()];
      setHoraAtiva(proximo.length - 1);
      return proximo;
    });
  }, []);

  const updateHora = (idx, next) => setHoras((arr) => arr.map((h, i) => (i === idx ? next : h)));

  const removeHora = (idx) =>
    setHoras((arr) => {
      const proximo = arr.filter((_, i) => i !== idx);
      setHoraAtiva((a) => Math.max(0, Math.min(a, proximo.length - 1)));
      return proximo;
    });

  /* `useCallback([])`: o reiniciar virou ação registrada no header do
     título, e um `resetAll` recriado a cada render faria o effect que o
     registra rodar sem parar. Só chama setters, que já são estáveis. */
  const resetAll = useCallback(() => {
    setHoras([]);
    setHoraAtiva(0);
    setInicioData('');
    setInicioHora('');
    setInicioAberto(false);
    setPeso('');
    setNpoHoras('');
    setHctInicial('');
    setAltura('');
    setIdade('');
    setCreatinina('');
    setVerLivro(false);
    try {
      localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
      /* nada a fazer */
    }
  }, []);

  /* Resumo do paciente para a linha recolhida. Só entra o que foi preenchido —
     um resumo com "— kg · — cm" seria pior que nenhum. */
  /* Duas linhas, não uma corrida: quem é o PACIENTE e como é o CASO. Numa
     linha só, "65 kg · 1,70 m · mulher · 47 anos · jejum 8 h · pequeno porte ·
     Ht 38 → 25 · ClCr 102" quebra no meio de um assunto e não dá para varrer. */
  /* Ordem pedida pelo dono (01/09): quem é a pessoa antes das medidas —
     "mulher · 47a · 60 kg · 1,70 m". Idade abreviada porque "anos" por extenso
     empurrava a linha sem acrescentar nada. */
  const resumoCorpo = [
    sexo === 'masculino' ? 'homem' : sexo === 'feminino' ? 'mulher' : null,
    idadeN > 0 && `${numeroBr(idadeN)}a`,
    isPediatric && PED_CATEGORY_OPTIONS.find((o) => o.value === pedCategory)?.label.split(' (')[0],
    pesoN > 0 && `${numeroBr(pesoN, pesoN % 1 ? 1 : 0)} kg`,
    alturaN > 0 && `${numeroBr(alturaN / 100, 2)} m`,
  ].filter(Boolean).join(' · ');

  const resumoCaso = [
    npoN > 0 && `jejum ${numeroBr(npoN)} h`,
    PORTE_OPTIONS.find((o) => o.value === porte)?.nome,
    hctIN > 0 && `Ht ${numeroBr(hctIN)} → ${numeroBr(hctMN)}`,
    result.clcr > 0 && `ClCr ${numeroBr(result.clcr)}`,
  ].filter(Boolean).join(' · ');

  const resumoPaciente = [resumoCorpo, resumoCaso].filter(Boolean).join(' · ');

  const mostrarPaciente = pacienteAberto ?? !hasPreop;

  /* O pill "Transferir" só existe quando há hora registrada: sem registro não
     há o que passar, e botão inerte no header — que é das 61 calculadoras —
     é pior que a ausência dele. */
  useEffect(() => {
    registrarAcao(
      temHoras
        ? {
            label: 'Transferir',
            ariaLabel: 'Transferir balanço para um colega',
            onClick: () => {
              setErroTransf('');
              setTransferindo(true);
            },
          }
        : null
    );
    return () => registrarAcao(null);
  }, [temHoras, registrarAcao]);

  /* O reiniciar mora ao lado do TÍTULO da calculadora, não dentro do card
     (dono 02/09). Só existe com registro na tela: um botão de apagar sempre
     visível, numa tela sem nada a apagar, convida ao clique errado. */
  useEffect(() => {
    registrarAcaoTitulo(
      temHoras
        ? {
            ariaLabel: 'Limpar todos os registros',
            onClick: resetAll,
            icone: <RotateCcw className="w-5 h-5" aria-hidden="true" />,
          }
        : null
    );
    return () => registrarAcaoTitulo(null);
  }, [temHoras, registrarAcaoTitulo, resetAll]);

  // Uma transferência esperando por mim, se houver.
  useEffect(() => {
    let vivo = true;
    if (!user) return undefined;
    buscarTransferenciaPendente(user)
      .then((t) => vivo && setRecebida(t))
      .catch(() => {
        /* sem sinal na sala: a calculadora continua funcionando offline */
      });
    return () => {
      vivo = false;
    };
  }, [user]);

  const rascunhoAtual = {
    populacao, pedCategory, peso, npoHoras, porte, hctInicial, hctMinimo, horas,
    sexo, altura, idade, creatinina, inicioData, inicioHora,
  };

  const enviarTransferencia = async () => {
    setEnviando(true);
    setErroTransf('');
    try {
      await transferirBalanco({ userInfo: user, paraUserId: colegaId, rascunho: rascunhoAtual });
      // Entrega limpa: quem passou perde o registro, para não haver dois
      // lançando no mesmo paciente (decisão do dono 01/09).
      resetAll();
      setTransferindo(false);
      setColegaId('');
    } catch (e) {
      setErroTransf(e?.message || 'Não foi possível transferir. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const assumirRecebida = async () => {
    try {
      const payload = await assumirTransferencia({ userInfo: user, id: recebida.id });
      if (payload) {
        setPopulacao(payload.populacao ?? 'adulto');
        setPedCategory(payload.pedCategory ?? 'crianca');
        setPeso(payload.peso ?? '');
        setAltura(payload.altura ?? '');
        setSexo(payload.sexo ?? '');
        setIdade(payload.idade ?? '');
        setCreatinina(payload.creatinina ?? '');
        setNpoHoras(payload.npoHoras ?? '');
        setPorte(payload.porte ?? 'medio');
        setHctInicial(payload.hctInicial ?? '');
        setHctMinimo(payload.hctMinimo ?? '25');
        setHoras(Array.isArray(payload.horas) ? payload.horas : []);
        setHoraAtiva(Math.max(0, (payload.horas?.length ?? 1) - 1));
        // O relógio do procedimento viaja junto: quem assume continua a MESMA
        // cirurgia, e recomeçar a contagem do zero mentiria sobre o tempo.
        setInicioData(payload.inicioData ?? '');
        setInicioHora(payload.inicioHora ?? '');
        setInicioAberto(false);
        setPacienteAberto(false);
      }
      setRecebida(null);
    } catch {
      setErroTransf('Não foi possível assumir agora.');
    }
  };

  const recusarRecebida = async () => {
    try {
      await recusarTransferencia({ userInfo: user, id: recebida.id });
    } finally {
      setRecebida(null);
    }
  };

  const nomeDe = (uid) => colegas?.find((o) => o.value === uid)?.label || 'Um colega';
  const horasRecebidas = recebida?.payload?.horas?.length ?? 0;

  const balancoAccent = (() => {
    const b = result.balancoNet;
    if (Math.abs(b) < 500) return 'text-primary';
    // ⚠️ não existe âmbar legível no DS (--warning é #F59E0B e
    // --warning-foreground é PRETO: o âmbar é preenchimento, não texto).
    // A faixa intermediária fica NEUTRA — cor só quando há o que sinalizar.
    if (Math.abs(b) < 1500) return 'text-foreground';
    return 'text-destructive';
  })();

  /* Cada alerta mora em UM lugar só. Os vermelhos sobem para a barra grudada,
   * porque anúria, perda permitida atingida e hipovolemia não podem esperar a
   * rolagem; os amarelos ficam no bloco de baixo. Repetir os dois lugares
   * deixava o mesmo texto duas vezes na tela a 375px — é o "informação
   * duplicada" que o dono já reprovou no card de Inibidores. */
  const alertasGraves = result.alerts.filter((a) => a.level === 'destructive');
  const alertasAtencao = result.alerts.filter((a) => a.level !== 'destructive');

  const alertas = alertasAtencao.length > 0 && (
    <div className="space-y-2" role="alert">
      {alertasAtencao.map((alert, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-2 p-3 rounded-lg border text-sm',
            'bg-warning/10 border-warning/50 text-foreground'
          )}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        'space-y-4',
        // Deitado sobra largura e faltam 375px de altura: entradas à esquerda,
        // resultado à direita, e a tela inteira cabe sem rolar.
        'deitado:space-y-0 deitado:grid deitado:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] deitado:gap-3 deitado:items-start'
      )}
    >
      {/* 0. RECEBIDO DE UM COLEGA — antes de tudo: é decisão a tomar antes de
             olhar qualquer número, e assumir SUBSTITUI o que está na tela. */}
      {recebida && (
        <section
          aria-label="Balanço recebido"
          className="rounded-xl border border-primary/50 bg-accent dark:bg-card p-4 space-y-3 deitado:col-span-2"
        >
          <div className="flex items-start gap-2">
            <ArrowDownToLine className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {nomeDe(recebida.de_user_id)} transferiu um balanço
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {horasRecebidas} {horasRecebidas === 1 ? 'hora' : 'horas'}
                {resumoDoPayload(recebida.payload) && ` · ${resumoDoPayload(recebida.payload)}`}
              </p>
            </div>
          </div>

          {/* ⚠️ Sem este aviso, assumir apagaria em silêncio horas de OUTRO
              paciente — é a perda que esta tela existe para evitar. */}
          {temHoras && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-2.5 text-xs text-foreground">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Você tem um balanço de <b>{horas.length} {horas.length === 1 ? 'hora' : 'horas'}</b>{' '}
                em andamento. Assumir substitui o seu.
              </span>
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={recusarRecebida} className="flex-1 min-h-[44px]">
              Recusar
            </Button>
            <Button onClick={assumirRecebida} className="flex-1 min-h-[44px]">
              Assumir
            </Button>
          </div>
        </section>
      )}

      {/* 3. PRÉ-OP */}
      <section
        aria-labelledby="preop-heading"
        className={cn(
          'rounded-xl border border-border-strong bg-card deitado:col-span-2 deitado:row-start-1',
          // recolhido não precisa do respiro de um formulário aberto
          mostrarPaciente ? 'p-4 space-y-4' : 'px-4 py-2.5 space-y-0.5'
        )}
      >
        {/* ⚠️ O paciente é a PRIMEIRA seção e recolhe sozinha depois de
            preenchida (dono 31/08: "informações do paciente estão no meio da
            tela, está errado"). Preenche-se uma vez, no início; durante a
            cirurgia ela vira uma linha e devolve a tela para o que se usa. */}
        <div className="flex items-center justify-between gap-2">
          <h3
            id="preop-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <User className="w-5 h-5 text-primary" aria-hidden="true" />
            Paciente
          </h3>
          {hasPreop && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPacienteAberto(!mostrarPaciente)}
              aria-expanded={mostrarPaciente}
              aria-controls="preop-campos"
              /* ⚠️ `-my-2`: o botão precisa dos 44px de alvo de toque, mas a
                 linha do título tem ~24px — sem isso ele estica a linha inteira
                 e abre o vão que o dono apontou. A área de toque continua
                 inteira; só o espaço que ela reservava sai. */
              className="text-muted-foreground min-h-[44px] shrink-0 -my-2 px-2"
            >
              {mostrarPaciente ? 'ocultar' : 'alterar'}
              <ChevronRight
                className={cn('w-4 h-4 ml-1 transition-transform', mostrarPaciente && 'rotate-90')}
                aria-hidden="true"
              />
            </Button>
          )}
        </div>

        {!mostrarPaciente && resumoPaciente && (
          <div className="text-[13px] leading-snug">
            <p className="text-foreground">{resumoCorpo}</p>
            {resumoCaso && <p className="text-muted-foreground">{resumoCaso}</p>}
          </div>
        )}

        <div id="preop-campos" hidden={!mostrarPaciente} className="space-y-4">
        <PillToggle value={populacao} onChange={setPopulacao} />

        {/* Sexo só no adulto: Nadler e o 75/65 ml/kg são validados em adultos, e
            na criança o volume por kg já vem da faixa etária. */}
        {!isPediatric && (
          <div className="flex items-center gap-3 flex-wrap">
            <SexoToggle value={sexo} onChange={setSexo} />
            <p className="text-xs text-muted-foreground flex-1 min-w-[180px]">
              {sexo
                ? 'Volume sanguíneo ajustado ao sexo' +
                  (alturaN > 0 ? ' e à altura (Nadler).' : '. Informe a altura para usar Nadler.')
                : 'Sem sexo informado, o volume sanguíneo usa a média de 70 ml/kg.'}
            </p>
          </div>
        )}

        {/* Os PARES são o pedido do dono (peso+altura · jejum+porte ·
            Ht inicial+Ht mínimo), mas em 2 colunas iguais o gatilho do Select
            cede só 69px ao texto e "Médio — 4 ml/kg/h" não cabe. Em 6 colunas
            os pares seguem iguais e o porte fica com 4/6 da linha, que é o que
            faz a taxa caber sem truncar. Medido a 375px. */}
        <div className="grid grid-cols-12 gap-3">
          <Input
            className="col-span-6"
            type="number"
            label="Peso (kg)"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            min={0.5}
            max={200}
            step={0.1}
            placeholder={isPediatric ? '15' : '70'}
            required
          />
          <Input
            className="col-span-6"
            type="number"
            label="Altura (cm)"
            value={altura}
            onChange={(e) => setAltura(e.target.value)}
            min={40}
            max={230}
            step={1}
            placeholder={isPediatric ? '100' : '170'}
          />
          <Input
            className="col-span-3"
            type="number"
            label="Jejum (h)"
            value={npoHoras}
            onChange={(e) => setNpoHoras(e.target.value)}
            min={0}
            max={24}
            step={1}
            placeholder="8"
          />
          <Select
            className="col-span-9"
            label="Porte cirúrgico"
            options={PORTE_OPTIONS}
            value={porte}
            onChange={setPorte}
            placeholder="Selecione o porte"
          />
          {isPediatric && (
            <div className="col-span-12">
              <Select
                label="Faixa etária pediátrica"
                options={PED_CATEGORY_OPTIONS}
                value={pedCategory}
                onChange={setPedCategory}
              />
            </div>
          )}
          <Input
            className="col-span-6"
            type="number"
            label="Ht inicial (%)"
            value={hctInicial}
            onChange={(e) => setHctInicial(e.target.value)}
            min={15}
            max={65}
            step={1}
            placeholder="40"
          />
          <Input
            className="col-span-6"
            type="number"
            label="Ht mínimo (%)"
            value={hctMinimo}
            onChange={(e) => setHctMinimo(e.target.value)}
            min={15}
            max={40}
            step={1}
            placeholder="25"
          />
        </div>

        {/* Função renal — opcional. Só os CAMPOS: o porquê de pedir creatinina
            e não ureia mora no dropdown do fim (dono 31/08: "deixe apenas os
            parâmetros a serem preenchidos"). */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Função renal (opcional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Idade (anos)"
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              min={0}
              max={120}
              step={1}
              placeholder="60"
            />
            <Input
              type="number"
              label="Creatinina (mg/dL)"
              value={creatinina}
              onChange={(e) => setCreatinina(e.target.value)}
              min={0.1}
              max={20}
              step={0.1}
              placeholder="1,0"
            />
          </div>
          {result.clcr > 0 && result.renal && (
            <div
              className={cn(
                'rounded-lg border p-2.5 text-xs font-semibold',
                result.renal.reduzida
                  ? 'bg-warning/10 border-warning/50 text-foreground'
                  : 'bg-primary/10 border-primary/40 text-primary'
              )}
            >
              Depuração de creatinina {numeroBr(result.clcr)} ml/min — KDIGO {result.renal.estagio},{' '}
              {result.renal.rotulo}
              {!sexo && ' (informe o sexo: na mulher a fórmula desconta 15%)'}
            </div>
          )}
        </div>
        </div>
      </section>

      {/* 1a. RESULTADO GRUDADO — só o número e os três totais.
          ⚠️ Deliberadamente ENXUTO. A primeira versão trazia junto a série, o
          botão do livro e os alertas: dava 359px de altura e, num iPhone SE
          (375×667) com cabeçalho de 49 e barra inferior de 65, sobravam 194px
          para digitar — metade do necessário. Medido nos três aparelhos. O que
          precisa estar SEMPRE à vista é o número; o resto rola logo abaixo. */}
      {hasPreop && temHoras && (
        <section
          aria-labelledby="balanco-heading"
          aria-live="polite"
          className={cn(
            /* ⚠️ CARTÃO, igual ao do Paciente — dono 02/09: "quero que o card
               de baixo fique igual ao de cima". Era faixa de largura total
               desde 31/08, quando o cartão arredondado deslizando sobre os
               outros foi lido como "cards flutuando"; o dono reviu a decisão
               com a tela pronta. Continua GRUDADO no topo: o número precisa
               estar à vista enquanto se digita a hora, e há teste medindo isso
               (`balanco-hidrico-layout.spec.ts`). */
            'rounded-xl border border-border-strong bg-card px-4 py-2.5 space-y-1',
            // `top-14` e não `top-0`: o cabeçalho do app é fixo com espaçador
            // `h-14` (App.jsx:519), e grudar em 0 enfiava o número por baixo
            // dele — visto ao rolar, nos dois sentidos.
            'sticky top-14 z-20',
            'deitado:col-start-2 deitado:row-start-2'
          )}
        >
          {/* Deitado a coluna tem ~305px: lado a lado, o rótulo quebrava em duas
              linhas e o "ml" caía sozinho. Empilhado, cabe. */}
          <div className="flex items-baseline justify-between gap-2 deitado:flex-col deitado:items-start deitado:gap-0">
            <h3
              id="balanco-heading"
              className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              Balanço · {horas.length} {horas.length === 1 ? 'hora' : 'horas'}
            </h3>
            <p className={cn('text-3xl font-bold leading-none tabular-nums', balancoAccent)}>
              {result.balancoNet >= 0 ? '+' : ''}
              {numeroBr(result.balancoNet)}
              <span className="text-sm font-semibold"> ml</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
            <span>
              Infundido <b className="text-foreground">{numeroBr(result.totalInfundido)}</b>
            </span>
            <span>
              Diurese <b className="text-foreground">{numeroBr(result.totalDiurese)}</b>/
              {numeroBr(result.metaDiureseAcumulada)}
            </span>
            {result.abl > 0 && (
              <span>
                Sangramento máximo{' '}
                <b className="text-foreground">{numeroBr(result.ablRestante)}</b> ml
              </span>
            )}
          </div>

          {/* Só os alertas VERMELHOS: anúria, perda permitida atingida e
              hipovolemia não podem esperar a rolagem. Os amarelos ficam no
              bloco de baixo — nenhum texto aparece nos dois lugares. */}
          {alertasGraves.map((a, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 text-xs font-semibold text-destructive"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{a.message}</span>
            </p>
          ))}
        </section>
      )}

      {/* 2. ACOMPANHAMENTO — uma hora por vez, fita rolável.
          ⚠️ SEM título próprio (dono 02/09): "Hora a hora" repetia o que a fita
          e a pill da hora já dizem, e o card é o único da tela com um. O
          "Limpar" que morava ao lado dele foi para a direita do TÍTULO da
          calculadora, via `registrarAcaoTitulo`. O nome continua existindo para
          quem usa leitor de tela, no `aria-label` da seção. */}
      <section
        aria-label="Hora a hora"
        className={cn(
          'rounded-xl border border-border-strong bg-card p-4 space-y-3',
          'deitado:col-start-1 deitado:row-start-2'
        )}
      >
        {!hasPreop && (
          <p className="text-sm text-muted-foreground italic">
            Preencha o peso primeiro para iniciar o registro.
          </p>
        )}

        {hasPreop && !temHoras && (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma hora registrada ainda. Use o botão abaixo para adicionar a 1ª hora.
          </p>
        )}

        {/* ── Início do procedimento ──────────────────────────────────────
            Faixa fina, não campos soltos: o início ancora a SÉRIE, então mora
            com ela e continua à vista com o Paciente recolhido — que é onde o
            tempo corrido importa (decisão do dono 02/09). */}
        {hasPreop && temHoras && (
          <div className="rounded-lg border border-border bg-muted px-2.5 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {/* ⚠️ DUAS linhas, não uma corrida: a 393px "02/09 · 06:45 ·
                  5 h 30 de procedimento" mais o "alterar" não cabem, e a linha
                  única quebrava no meio da hora ("02/09 ·" / "06:45") e
                  truncava o resto em "de proce…". Medido no e2e mobile. */}
              <p className="flex flex-col min-w-0 text-xs leading-tight gap-0.5">
                <span className="flex items-center gap-1.5">
                  <CalendarClock
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  {inicio ? (
                    <b className="font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {dataCurta(inicio)} · {horaCurta(inicio)}
                    </b>
                  ) : (
                    <span className="text-muted-foreground">Início não informado</span>
                  )}
                </span>
                {corrido && (
                  <span className="text-muted-foreground pl-5">{corrido} de procedimento</span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInicioAberto((v) => !v)}
                aria-expanded={inicioAberto}
                aria-controls="inicio-campos"
                /* Mesmo `-my-2` do "alterar" do Paciente: mantém os 44px de
                   alvo sem esticar a faixa, que é fina de propósito. */
                className="text-muted-foreground min-h-[44px] shrink-0 -my-2 px-2 text-xs"
              >
                {inicioAberto ? 'ocultar' : inicio ? 'alterar' : 'informar'}
                <ChevronRight
                  className={cn(
                    'w-4 h-4 ml-1 transition-transform',
                    inicioAberto && 'rotate-90'
                  )}
                  aria-hidden="true"
                />
              </Button>
            </div>

            {/* ⚠️ Montagem condicional, e NÃO `hidden` como no bloco do
                Paciente: `[hidden]{display:none}` e a utility `grid` têm a
                mesma especificidade, e a utility vem depois na folha — o campo
                ficava aberto o tempo todo (visto no e2e). Lá funciona porque
                `space-y-4` não declara `display`. */}
            {inicioAberto && (
              /* ⚠️ Colunas FLUIDAS, não `grid-cols-2`: o widget nativo de data
                 escreve no formato do sistema, e no iPhone em pt-BR isso é
                 "2 de set. de 2026" — ~135px de texto que não cabem nos 104px
                 úteis de meia largura. O input não encolhe (largura intrínseca
                 do widget), então a caixa vazava POR BAIXO da caixa da hora
                 (foto do dono, 02/09). Com `auto-fit/minmax(200px)` os dois
                 campos empilham no celular e voltam a ficar lado a lado onde
                 sobra largura — deitado, ou em tela grande. */
              <div
                id="inicio-campos"
                className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]"
              >
                {/* `min-w-0` nos dois níveis: item de grid e o control do DS
                    nascem com `min-width:auto`, que é o que deixa o conteúdo
                    intrínseco empurrar a caixa para fora do track. */}
                <Input
                  className="min-w-0 [&_[data-slot=input-control]]:min-w-0"
                  type="date"
                  label="Data de início"
                  value={inicioData}
                  onChange={(e) => setInicioData(e.target.value)}
                />
                <Input
                  className="min-w-0 [&_[data-slot=input-control]]:min-w-0"
                  type="time"
                  label="Hora de início"
                  value={inicioHora}
                  onChange={(e) => setInicioHora(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {hasPreop && temHoras && (
          <>
            {/* Fita de horas. Hand-rolled de propósito: o TabsContent do DS
                DESMONTA o painel inativo, e com o valor digitado dentro da aba
                trocar de hora APAGARIA o registro. Aqui o array `horas` mora na
                raiz e a aba só muda um índice. */}
            <div
              ref={fitaRef}
              role="tablist"
              aria-label="Horas registradas"
              className="flex gap-1.5 overflow-x-auto p-1 rounded-2xl bg-muted border border-border"
            >
              {horas.map((h, i) => {
                const d = medido(h.diurese);
                const abaixoDaMeta = d !== null && d < result.goalRate;
                const ativo = i === indiceAtivo;
                /* O número FICA e o relógio entra embaixo (dono 02/09): o
                   número é o que a conta usa e o que os alertas citam ("anúria
                   na hora 3"); o relógio é como se procura a hora na sala. */
                const relogio = inicio ? rotuloHora(inicio, i + 1) : '';
                return (
                  <button
                    key={h.id}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    aria-label={
                      `Hora ${i + 1}` +
                      (relogio ? `, ${faixaHora(inicio, i + 1)}` : '') +
                      (abaixoDaMeta ? ', diurese abaixo da meta' : '')
                    }
                    onClick={() => setHoraAtiva(i)}
                    className={cn(
                      'shrink-0 min-w-[44px] min-h-[44px] rounded-xl text-sm font-bold',
                      'flex flex-col items-center justify-center transition-colors',
                      relogio ? 'px-2.5 leading-tight' : 'px-3',
                      ativo
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {i + 1}
                      {abaixoDaMeta && (
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
                      )}
                    </span>
                    {relogio && (
                      <span className="text-[10px] font-semibold opacity-80 tabular-nums">
                        {relogio}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={addHora}
                aria-label={`Adicionar hora ${horas.length + 1}`}
                className="shrink-0 min-w-[44px] min-h-[44px] px-3 rounded-xl text-primary flex items-center justify-center hover:bg-card/60"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* ⚠️ Convite, não automatismo: a hora nasce de um toque. Uma hora
                criada sozinha entraria em branco na conta como se tivesse sido
                medida — manutenção e terceiro espaço contam por hora
                REGISTRADA (evaluateBalance: `rate * horas.length`). */}
            {precisaAbrirHora && (
              <Button
                variant="outline"
                onClick={addHora}
                className="w-full min-h-[44px] border-primary/50 text-primary"
                aria-label={`Já são ${horaCurta(agora)}. Abrir a hora ${horas.length + 1}`}
              >
                <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Já são {horaCurta(agora)} — abrir a hora {horas.length + 1}
              </Button>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold tabular-nums">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Hora {indiceAtivo + 1}
                {inicio && ` · ${faixaHora(inicio, indiceAtivo + 1)}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeHora(indiceAtivo)}
                aria-label={`Remover hora ${indiceAtivo + 1}`}
                className="text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* A série de diurese mora colada na FITA (dono 02/09): as barras
                são as mesmas horas das abas logo acima, e lidas juntas mostram
                a tendência sem sair do bloco. O livro e os alertas continuam
                no cartão de baixo — ali é consulta, aqui é acompanhamento. */}
            <SerieDiurese diureses={result.diureses} meta={result.goalRate} ativa={indiceAtivo} />

            <HoraCampos
              hora={horas[indiceAtivo]}
              onChange={(next) => updateHora(indiceAtivo, next)}
            />
          </>
        )}

        {hasPreop && !temHoras && (
          <Button
            variant="outline"
            onClick={addHora}
            className="w-full min-h-[44px]"
            aria-label="Adicionar nova hora"
          >
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Adicionar hora 1
          </Button>
        )}
      </section>

      {/* 1b. LIVRO E ALERTAS — rolam. A série saiu daqui em 02/09 e foi para
          junto da fita; sobrou o que é CONSULTA: as 12 horas em tabela e os
          alertas amarelos. */}
      {hasPreop && temHoras && (
        <section
          aria-label="Tendência e alertas"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-3 deitado:col-start-2 deitado:row-start-3"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVerLivro((v) => !v)}
            className="w-full min-h-[44px]"
            aria-expanded={verLivro}
          >
            {verLivro ? (
              <ChevronUp className="w-4 h-4 mr-1.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-1.5" aria-hidden="true" />
            )}
            {verLivro ? 'ocultar as horas' : `ver as ${horas.length} horas`}
          </Button>

          {verLivro && (
            <LivroRazao
              horas={horas}
              rate={result.rate}
              tsLoss={result.tsLoss}
              meta={result.goalRate}
              inicio={inicio}
            />
          )}

          {alertas}
        </section>
      )}

      {/* 4. ESTIMATIVAS */}
      {hasPreop && (
        <section
          aria-labelledby="estimativas-heading"
          className="rounded-xl border border-border-strong bg-card p-4 space-y-3 deitado:col-span-2"
        >
          <h3
            id="estimativas-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <TrendingDown className="w-5 h-5 text-primary" aria-hidden="true" />
            Números do caso
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 deitado:grid-cols-4 gap-3">
            {/* ⚠️ As estimativas CONVERSAM com as horas (dono 31/08: "não
                apenas cards para consulta"). Cada taxa mostra, ao lado, o que
                ela já significou nas horas registradas — e a meta de diurese
                mostra a diurese REAL, que é a comparação que muda conduta. */}
            <MetricCard
              label="Manutenção"
              value={numeroBr(result.rate)}
              unit="ml/h"
              detalhe={temHoras ? `${numeroBr(result.totalManutencao)} ml em ${horas.length} h` : null}
              accent="primary"
            />
            <MetricCard label="Déficit jejum" value={numeroBr(deficit)} unit="ml" />
            <MetricCard
              label="3º espaço"
              value={numeroBr(result.tsLoss)}
              unit="ml/h"
              detalhe={temHoras ? `${numeroBr(result.totalTerceiroEspaco)} ml em ${horas.length} h` : null}
            />
            <MetricCard
              label="Meta diurese"
              value={numeroBr(result.goalRate)}
              unit="ml/h"
              detalhe={temHoras ? `real ${numeroBr(result.totalDiurese / horas.length)} ml/h` : null}
              accent="primary"
            />
            <MetricCard
              label="Volume sanguíneo"
              value={numeroBr(result.ebv)}
              unit="ml"
              detalhe={alturaN > 0 && sexo ? 'Nadler' : `${numeroBr(result.ebv / pesoN, 0)} ml/kg`}
            />
            {/* ⚠️ Aqui o número é o TETO deste paciente — quanto ele pode
                sangrar no total antes de a transfusão ficar indicada. O valor
                que desconta o que já sangrou vive na FAIXA do topo, que é onde
                se olha durante a cirurgia (dono 01/09). O detalhe só aparece
                depois que há sangramento: antes, "restam 1.793 de 1.793" é
                ruído. */}
            <MetricCard
              label="Sangramento máximo permitido"
              value={result.abl > 0 ? numeroBr(result.abl) : '—'}
              unit={result.abl > 0 ? 'ml' : ''}
              detalhe={
                result.abl <= 0
                  ? 'informe o Ht'
                  : result.totalSangramento > 0
                    ? `restam ${numeroBr(result.ablRestante)} ml`
                    : null
              }
              accent={result.abl > 0 ? 'warning' : 'default'}
            />
            {temHoras && result.totalSangramento > 0 && (
              <MetricCard
                label="Repor sangramento"
                value={numeroBr(result.reposicaoCristaloide)}
                unit="ml"
                detalhe="cristaloide 3:1"
                accent="warning"
              />
            )}
            {temHoras && result.totalSangramento > 0 && (
              <MetricCard
                label="ou coloide/sangue"
                value={numeroBr(result.reposicaoColoide)}
                unit="ml"
                detalhe="1:1"
              />
            )}
          </div>

          {pesos && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Pesos de referência — IMC {numeroBr(pesos.imc, 1)} kg/m²
              </p>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Ideal" value={numeroBr(pesos.pesoIdeal, 1)} unit="kg" />
                <MetricCard label="Magro" value={numeroBr(pesos.pesoMagro, 1)} unit="kg" />
                <MetricCard label="Ajustado" value={numeroBr(pesos.pesoAjustado, 1)} unit="kg" />
              </div>
              {/* ⚠️ `pesoAjustado` é null abaixo de 152,4 cm: a Devine é linear a
                  partir de 5 pés e extrapolada para baixo dá número sem sentido.
                  Sem essa guarda a frase sairia "de 190 para —". */}
              {pesos.imc >= 30 && Number.isFinite(pesos.pesoAjustado) && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  IMC {numeroBr(pesos.imc, 1)} — em obesidade, a manutenção 4-2-1 pelo peso REAL
                  superestima o volume. Considere refazer a conta com o peso ajustado
                  ({numeroBr(pesos.pesoAjustado, 1)} kg): a manutenção cairia de{' '}
                  {numeroBr(result.rate)} para {numeroBr(maintenanceRate(pesos.pesoAjustado))} ml/h.
                </p>
              )}
            </div>
          )}

          {/* Mesma casca dos demais sub-blocos. Era `bg-info/10` + `text-info`:
              uma caixa AZUL no meio de uma tela verde e âmbar, e a própria rule
              de tokens registra que o `info` (#007AFF) parece fora do padrão. */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Reposição do déficit — Furman 50/25/25
            </p>
            <p className="text-xs text-foreground">
              <span className="font-medium">1ª hora:</span> {numeroBr(furman1)} ml ·{' '}
              <span className="font-medium">2ª hora:</span> {numeroBr(furman2)} ml ·{' '}
              <span className="font-medium">3ª hora:</span> {numeroBr(furman3)} ml
            </p>
          </div>

          <details className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-foreground select-none min-h-[44px] flex items-center">
              Exemplos por porte, glossário e o que entra na conta
            </summary>
            <dl className="mt-3 space-y-3">
              {/* Os exemplos dos TRÊS portes vivem aqui, e não no formulário:
                  quem já sabe o porte não precisa lê-los toda vez, e no meio
                  dos campos eles poluíam a tela (dono 31/08). */}
              {PORTE_OPTIONS.map((o) => (
                <div key={o.value}>
                  <dt className="font-semibold text-foreground">
                    Exemplos de {o.nome} — {o.label.split('— ')[1]}
                  </dt>
                  <dd>
                    {PORTE_EXEMPLOS[o.value].exemplos}
                    {PORTE_EXEMPLOS[o.value].nota && (
                      <span className="block mt-1">{PORTE_EXEMPLOS[o.value].nota}</span>
                    )}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="font-semibold text-foreground">Volume sanguíneo estimado (EBV)</dt>
                <dd>
                  Base para a perda sanguínea permitida e para o impacto do sangramento sobre o
                  hematócrito. Com <strong>sexo e altura</strong>, usa a equação de{' '}
                  <strong>Nadler (1962)</strong> — BV(L) = k₁ × altura(m)³ + k₂ × peso + k₃ —, que
                  separa o componente da estatura do componente do peso e por isso não superestima
                  no obeso, em quem o tecido adiposo é pouco vascularizado. Sem altura, cai em
                  ml/kg: <strong>75 no homem, 65 na mulher</strong>, 70 se o sexo não foi informado;
                  na criança, 75 ml/kg, 80 lactente, 85 neonato, 95 prematuro.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Perda sanguínea permitida (ABL)</dt>
                <dd>
                  Volume máximo de sangue que o paciente pode perder antes de exigir transfusão,
                  mantendo o hematócrito mínimo escolhido como meta. Fórmula de Gross (1983):{' '}
                  <em>perda permitida = volume sanguíneo × (Ht inicial − Ht mínimo) / Ht inicial</em>.
                  Quando o sangramento acumulado se aproxima dela, considerar hemoderivados.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Reposição do sangramento</dt>
                <dd>
                  Cristaloide na proporção <strong>3:1</strong> (três volumes para cada volume
                  perdido, porque só um terço permanece no intravascular) ou coloide/hemoderivado{' '}
                  <strong>1:1</strong>. O cartão &quot;Repor sangramento&quot; aplica a regra ao
                  sangramento já registrado.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Função renal e balanço hídrico</dt>
                <dd>
                  A depuração de creatinina sai de <strong>Cockcroft-Gault</strong> — (140 − idade) ×
                  peso / (72 × creatinina), × 0,85 na mulher — a mesma fórmula do card
                  &quot;Depuração de Creatinina&quot;, para o app não dar dois números ao mesmo
                  paciente. <strong>A meta de diurese NÃO sobe com rim ruim.</strong> Oligúria
                  intraoperatória isolada é preditor fraco de lesão renal aguda (valor preditivo
                  positivo em torno de 25%) e o paciente oligúrico hemodinamicamente estável não
                  responde a prova de volume: perseguir diurese com expansão troca um risco pelo de
                  sobrecarga, que o rim doente tem menos como desfazer. O que muda é a leitura —
                  evitar balanço muito positivo — e a escolha do coloide:{' '}
                  <strong>hidroxietilamido (HES)</strong> teve a autorização suspensa na União
                  Europeia em 2022 por lesão renal e mortalidade, e é contraindicado aqui;
                  albumina não tem essa restrição.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Por que não pedimos ureia</dt>
                <dd>
                  A ureia sobe por motivos que nada têm a ver com filtração — jejum, catabolismo,
                  corticoide, dieta hiperproteica e sangramento digestivo — e a razão
                  ureia/creatinina dificilmente separa causa pré-renal de necrose tubular. Para o
                  que este card precisa decidir, creatinina com idade, peso e sexo basta e é
                  acionável.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">POQI (Perioperative Quality Initiative)</dt>
                <dd>
                  Iniciativa internacional de consenso para protocolos perioperatórios, com painéis
                  multidisciplinares que publicam recomendações em revistas como BJA. O POQI-11
                  (2024) revisitou fluidoterapia intraoperatória: terceiro espaço é conceito
                  controverso desde 2008 (glicocálix endotelial), e a meta atual é normovolemia —
                  nem restrição extrema (risco de AKI, ver RELIEF NEJM 2018) nem liberalismo
                  (risco de sobrecarga / SSI).
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Furman 50/25/25</dt>
                <dd>
                  Esquema de reposição do déficit de jejum proposto por Furman (Anesthesiology
                  1975). O déficit total (manutenção/h × horas de jejum) é reposto em 3 horas:{' '}
                  <strong>50%</strong> na 1ª hora, <strong>25%</strong> na 2ª e <strong>25%</strong>{' '}
                  na 3ª — sempre somado à manutenção horária basal (regra 4-2-1). Ex.: adulto 70 kg
                  com 8 h de jejum → déficit 880 ml → 1ª hora ≈ 550 ml (440 + 110 de manutenção),
                  2ª e 3ª horas ≈ 330 ml cada.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Diurese não medida × diurese zero</dt>
                <dd>
                  O campo de diurese em branco significa <strong>não medida</strong> e não entra em
                  alerta nenhum. Um <strong>0</strong> digitado é anúria registrada e dispara alerta
                  vermelho — é o pior achado urinário e não pode ficar mudo.
                </dd>
              </div>
            </dl>
          </details>
        </section>
      )}
      {/* Folha de transferência — aberta pelo pill do header. */}
      <Sheet open={transferindo} onOpenChange={(o) => !o && setTransferindo(false)}>
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader className="pb-2">
            <SheetTitle>Transferir balanço</SheetTitle>
          </SheetHeader>

          <div className="space-y-3 pb-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {horas.length} {horas.length === 1 ? 'hora registrada' : 'horas registradas'}
              {resumoCorpo && ` · ${resumoCorpo}`}. Depois de transferir, o registro sai deste
              aparelho.
            </p>

            <Select
              label="Colega que vai receber"
              options={(colegas || []).filter((o) => o.value !== user?.uid)}
              value={colegaId}
              onChange={setColegaId}
              placeholder="Escolha o colega"
              searchable
            />

            {erroTransf && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-foreground">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{erroTransf}</span>
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setTransferindo(false)}
                className="flex-1 min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button
                onClick={enviarTransferencia}
                disabled={!colegaId || enviando}
                className="flex-1 min-h-[44px]"
              >
                {enviando ? 'Transferindo…' : 'Transferir'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
