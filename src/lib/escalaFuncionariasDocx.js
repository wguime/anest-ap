/**
 * Parser do docx UNIFICADO da escala mensal das funcionárias (sobreaviso materno
 * + hospitais UNIMED/HRO/Plantão Pago) — puro, determinístico, sem IA.
 *
 * Porta as regras de .claude/skills/escala/scripts/importar.py para o fluxo
 * in-app (Hub Escalas Funcionárias → Importar). Formato esperado: uma tabela,
 * uma linha por dia, 7 colunas:
 *   DATA · DIA · SOBREAVISO · UNIMED (07-15) · HRO (07-15) · PLANTÃO PAGO (15-23) · FERIADO
 *
 * A chave é sempre a coluna DATA (dd/mm/aaaa); a coluna DIA é ignorada e o
 * dia-de-hospital é decidido pelo weekday CALCULADO + FERIADO_LABELS + coluna
 * FERIADO — o texto digitado não decide regra nenhuma.
 *
 * issues  → bloqueiam a publicação (nome inválido, dia faltando, slot obrigatório vazio)
 * avisos  → não bloqueiam; carregam sugestão acionável (ex.: fuzzy "Sayonara"→saionara,
 *           nunca aplicada automaticamente — a conferência oferece o botão)
 */
import { FUNCIONARIAS_SOBREAVISO } from '@/data/sobreavisoMaterno2026';
import { FERIADO_LABELS } from '@/data/plantao2026';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NA = new Set(['—', '-', '–']);
const DATA_RE = /(\d{2})\/(\d{2})\/(\d{4})/;

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Distância de Levenshtein com teto (basta saber se ≤ max). */
function levenshtein(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Resolve o texto de uma célula para uma funcionária.
 * @returns {{ id, nome } | null | { desconhecido, sugestao }} — null = célula
 * não-aplicável (vazia/'—'); `desconhecido` = texto lido; `sugestao` = funcionária
 * mais próxima (Levenshtein ≤ 2) ou null.
 */
export function resolverFuncionaria(raw, funcionarias = FUNCIONARIAS_SOBREAVISO) {
  const n = norm(raw);
  if (!n || NA.has(n)) return null;
  const key = n.toUpperCase();
  const exata = funcionarias.find((f) => f.id.toUpperCase() === key || f.nome.toUpperCase() === key);
  if (exata) return { id: exata.id, nome: exata.nome };
  let sugestao = null;
  if (key.length >= 4) {
    let melhor = 3;
    for (const f of funcionarias) {
      const d = levenshtein(key, f.nome.toUpperCase());
      if (d <= 2 && d < melhor) { melhor = d; sugestao = f; }
    }
  }
  return { desconhecido: n, sugestao };
}

/**
 * Extrai as linhas de todas as tabelas do docx como matriz de strings.
 * jszip entra por import dinâmico — o peso só é pago na tela de importação.
 * @param {File|Blob|ArrayBuffer|Uint8Array} fileOrBuffer
 * @returns {Promise<string[][]>}
 */
export async function extrairLinhasDocx(fileOrBuffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(fileOrBuffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('Arquivo não parece ser um docx válido (word/document.xml ausente)');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const linhas = [];
  for (const tr of Array.from(doc.getElementsByTagNameNS(WORD_NS, 'tr'))) {
    const cells = Array.from(tr.getElementsByTagNameNS(WORD_NS, 'tc')).map((tc) =>
      norm(Array.from(tc.getElementsByTagNameNS(WORD_NS, 't')).map((t) => t.textContent).join(''))
    );
    if (cells.length) linhas.push(cells);
  }
  return linhas;
}

const diasNoMes = (mes) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const weekday = (dateKey) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=dom, 6=sáb
};

function issueDe(dateKey, tipo, msg) {
  return { dateKey, tipo, msg };
}

function resolverCelula(raw, { dateKey, campo, issues, avisos }) {
  const r = resolverFuncionaria(raw);
  if (r && r.desconhecido) {
    if (r.sugestao) {
      avisos.push({
        dateKey, tipo: 'nome-fuzzy', campo, valorLido: r.desconhecido, sugestaoId: r.sugestao.id,
        msg: `${campo}: "${r.desconhecido}" não está na lista — quis dizer ${r.sugestao.nome}?`,
      });
    } else {
      issues.push(issueDe(dateKey, 'nome-desconhecido', `${campo}: nome desconhecido "${r.desconhecido}"`));
    }
    return null; // nome não resolvido nunca entra no resultado
  }
  return r;
}

/**
 * Parseia as linhas extraídas do docx.
 * @returns {{ mes, meses, sobreaviso, hospitais, issues, avisos }}
 * sobreaviso: { 'YYYY-MM-DD': id } · hospitais: { 'YYYY-MM-DD': {unimed,hro,plantaoPago,label} }
 * (nomes de hospitais sempre no Title Case CANÔNICO da lista — o lookup reverso
 * por nome dos consumidores depende disso)
 */
export function parseEscalaFuncionarias(linhas, { feriadoLabels = FERIADO_LABELS } = {}) {
  const sobreaviso = {};
  const hospitais = {};
  const issues = [];
  const avisos = [];
  const diasComLinha = new Set();

  for (const cells of linhas) {
    if (cells.length < 7) continue;
    const m = DATA_RE.exec(cells[0]);
    if (!m) continue; // header / linha sem data
    const [, dd, mm, yy] = m;
    const dateKey = `${yy}-${mm}-${dd}`;
    diasComLinha.add(dateKey);

    const wd = weekday(dateKey);
    const isSab = wd === 6;
    const isDom = wd === 0;
    const label = norm(cells[6]) && !NA.has(norm(cells[6])) ? norm(cells[6]) : null;
    const feriadoConhecido = dateKey in feriadoLabels;
    if (label && !feriadoConhecido) {
      avisos.push({
        dateKey, tipo: 'feriado-desconhecido', campo: 'feriado', valorLido: label,
        msg: `feriado "${label}" não consta em FERIADO_LABELS — o dia funciona, mas o pulo de dia útil do card noturno não o reconhecerá`,
      });
    }
    const isDiaHospital = isSab || isDom || feriadoConhecido || !!label;

    // --- SOBREAVISO (obrigatório todo dia) ---
    const s = resolverCelula(cells[2], { dateKey, campo: 'sobreaviso', issues, avisos });
    if (s) sobreaviso[dateKey] = s.id;
    else issues.push(issueDe(dateKey, 'sobreaviso-vazio', 'sobreaviso vazio'));

    // --- HOSPITAIS (FDS + feriados) ---
    const u = resolverCelula(cells[3], { dateKey, campo: 'unimed', issues, avisos });
    const h = resolverCelula(cells[4], { dateKey, campo: 'hro', issues, avisos });
    const p = resolverCelula(cells[5], { dateKey, campo: 'plantaoPago', issues, avisos });
    const hasAny = Boolean(u || h || p);

    if (isDiaHospital || hasAny) {
      if (!isDiaHospital && hasAny) {
        avisos.push({
          dateKey, tipo: 'hospital-dia-util', campo: 'hospitais', valorLido: null,
          msg: 'nomes de hospital em dia útil sem feriado — confirme se é intencional',
        });
      }
      if (isDiaHospital && !hasAny) {
        issues.push(issueDe(dateKey, 'hospital-vazio', 'linha de FDS/feriado sem nomes de hospital'));
        continue;
      }
      hospitais[dateKey] = {
        unimed: u?.nome || null,
        hro: h?.nome || null,
        plantaoPago: p?.nome || null,
        label,
      };
      if (isDiaHospital) {
        if (!h) issues.push(issueDe(dateKey, 'hro-faltando', 'hospital HRO faltando'));
        if (!p) issues.push(issueDe(dateKey, 'plantao-faltando', 'hospital PLANTÃO PAGO faltando'));
        if (!isDom && !u) issues.push(issueDe(dateKey, 'unimed-faltando', 'hospital UNIMED faltando (sábado/feriado)'));
      }
      if (isDom && u) {
        avisos.push({
          dateKey, tipo: 'unimed-domingo', campo: 'unimed', valorLido: u.nome,
          msg: 'UNIMED preenchida em domingo — a regra diz que domingo não tem UNIMED',
        });
      }
    }
  }

  const meses = [...new Set([...diasComLinha].map((k) => k.slice(0, 7)))].sort();
  if (meses.length > 1) {
    issues.push(issueDe(null, 'multi-mes', `arquivo abrange ${meses.length} meses (${meses.join(', ')}) — esperado 1`));
  }
  const mes = meses.length === 1 ? meses[0] : null;
  if (mes) {
    for (let d = 1; d <= diasNoMes(mes); d++) {
      const key = `${mes}-${String(d).padStart(2, '0')}`;
      if (!diasComLinha.has(key)) issues.push(issueDe(key, 'dia-faltando', 'dia ausente da tabela — mês incompleto'));
    }
  }

  return { mes, meses, sobreaviso, hospitais, issues, avisos };
}

/**
 * Revalida o estado EDITADO da conferência (mapas já com nomes válidos, vindos
 * de Selects). Subconjunto do parse: completude do mês + slots obrigatórios.
 */
export function validarEscalaFuncionarias(sobreaviso, hospitais, mes, { feriadoLabels = FERIADO_LABELS } = {}) {
  const issues = [];
  const avisos = [];
  if (!mes) return { issues: [issueDe(null, 'multi-mes', 'mês não identificado')], avisos };

  for (let d = 1; d <= diasNoMes(mes); d++) {
    const dateKey = `${mes}-${String(d).padStart(2, '0')}`;
    if (!sobreaviso[dateKey]) issues.push(issueDe(dateKey, 'sobreaviso-vazio', 'sobreaviso vazio'));

    const wd = weekday(dateKey);
    const isSab = wd === 6;
    const isDom = wd === 0;
    const entry = hospitais[dateKey];
    const feriadoConhecido = dateKey in feriadoLabels;
    const isDiaHospital = isSab || isDom || feriadoConhecido || Boolean(entry?.label);

    if (isDiaHospital) {
      if (!entry || !(entry.unimed || entry.hro || entry.plantaoPago)) {
        issues.push(issueDe(dateKey, 'hospital-vazio', 'dia de FDS/feriado sem nomes de hospital'));
        continue;
      }
      if (!entry.hro) issues.push(issueDe(dateKey, 'hro-faltando', 'hospital HRO faltando'));
      if (!entry.plantaoPago) issues.push(issueDe(dateKey, 'plantao-faltando', 'hospital PLANTÃO PAGO faltando'));
      if (!isDom && !entry.unimed) issues.push(issueDe(dateKey, 'unimed-faltando', 'hospital UNIMED faltando (sábado/feriado)'));
      if (isDom && entry.unimed) {
        avisos.push({ dateKey, tipo: 'unimed-domingo', campo: 'unimed', valorLido: entry.unimed, msg: 'UNIMED preenchida em domingo' });
      }
    } else if (entry && (entry.unimed || entry.hro || entry.plantaoPago)) {
      avisos.push({ dateKey, tipo: 'hospital-dia-util', campo: 'hospitais', valorLido: null, msg: 'nomes de hospital em dia útil sem feriado' });
    }
  }
  return { issues, avisos };
}

/** Conveniência: extrai + parseia direto do File. */
export async function parseEscalaFuncionariasDocx(file, opts) {
  const linhas = await extrairLinhasDocx(file);
  return parseEscalaFuncionarias(linhas, opts);
}
