/**
 * Relógio do procedimento — ancora uma série de blocos de 1 h em data e hora
 * reais de início.
 *
 * Nasceu do Balanço Hídrico Transoperatório, onde a série era "Hora 1, 2, 3…":
 * números sem relógio. Quem abre o app já na 3ª hora informa que começou às
 * 07:30, lança três horas e cada uma cai no horário certo — e a fita passa a
 * ser procurável pelo relógio da sala, que é como se pensa no centro cirúrgico.
 *
 * Funções puras, sem React. Datas em horário LOCAL: o app roda no fuso do
 * hospital e a suíte em America/Sao_Paulo (vite.config.js).
 */

const dois = (n) => String(n).padStart(2, '0');

const MS_HORA = 3600000;

/**
 * Junta os dois campos da tela num instante.
 *
 * @param {string} data 'YYYY-MM-DD' (valor nativo do input type="date")
 * @param {string} hora 'HH:MM'      (valor nativo do input type="time")
 * @returns {Date|null} null quando falta um dos dois ou o valor é inválido.
 *
 * ⚠️ Montado campo a campo, não com `new Date('2026-09-02T07:30')`: a string
 * sem fuso é interpretada como local pelos motores atuais, mas o construtor
 * explícito não depende dessa leitura — e é o que garante que 07:30 digitado
 * na sala seja 07:30 no relógio de quem digitou.
 */
export function inicioProcedimento(data, hora) {
  if (typeof data !== 'string' || typeof hora !== 'string') return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());
  const h = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!d || !h) return null;
  const ano = Number(d[1]);
  const mes = Number(d[2]);
  const dia = Number(d[3]);
  const horas = Number(h[1]);
  const min = Number(h[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || horas > 23 || min > 59) return null;
  const dt = new Date(ano, mes - 1, dia, horas, min, 0, 0);
  // 31/02 vira 03/03 no construtor: rejeitar em vez de aceitar a data torta.
  if (dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return null;
  return dt;
}

/** Os dois campos preenchidos com um instante — o "agora" sugerido na 1ª hora. */
export function camposDoInstante(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { data: '', hora: '' };
  return {
    data: `${date.getFullYear()}-${dois(date.getMonth() + 1)}-${dois(date.getDate())}`,
    hora: `${dois(date.getHours())}:${dois(date.getMinutes())}`,
  };
}

/** 'HH:MM' de um instante. String vazia se não for data válida. */
export function horaCurta(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${dois(date.getHours())}:${dois(date.getMinutes())}`;
}

/** 'DD/MM' de um instante — o ano não entra, a cirurgia é do dia. */
export function dataCurta(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${dois(date.getDate())}/${dois(date.getMonth() + 1)}`;
}

/**
 * Início e fim do bloco de 1 h de número `n` (1-based).
 * Hora 1 = do início até +1 h. Vira o dia sozinho em cirurgia que atravessa a
 * meia-noite — o Date cuida disso.
 */
export function janelaHora(inicio, n) {
  if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) return null;
  const ordem = Math.floor(n);
  if (!Number.isFinite(ordem) || ordem < 1) return null;
  const de = new Date(inicio.getTime() + (ordem - 1) * MS_HORA);
  const ate = new Date(inicio.getTime() + ordem * MS_HORA);
  return { de, ate };
}

/** '07:30' — o começo do bloco, que é o rótulo da aba. */
export function rotuloHora(inicio, n) {
  const j = janelaHora(inicio, n);
  return j ? horaCurta(j.de) : '';
}

/** '07:30–08:30' — a faixa inteira, que é o rótulo da hora aberta. */
export function faixaHora(inicio, n) {
  const j = janelaHora(inicio, n);
  return j ? `${horaCurta(j.de)}–${horaCurta(j.ate)}` : '';
}

/**
 * Tempo corrido desde o início, formatado: '48 min', '3 h 05'.
 * null quando não há início ou o relógio ainda não chegou nele (início digitado
 * no futuro — acontece ao errar a data, e mostrar "-2 h" não ajudaria ninguém).
 */
export function tempoDecorrido(inicio, agora = new Date()) {
  if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) return null;
  if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) return null;
  const minutos = Math.floor((agora.getTime() - inicio.getTime()) / 60000);
  if (minutos < 0) return null;
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${dois(minutos % 60)}`;
}

/**
 * Em que hora do procedimento o RELÓGIO está (1-based).
 * 0 antes do início. É o número comparado com o total de horas lançadas para
 * saber que a hora virou e ainda não há onde digitar.
 */
export function horaDoRelogio(inicio, agora = new Date()) {
  if (!(inicio instanceof Date) || Number.isNaN(inicio.getTime())) return 0;
  if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) return 0;
  const delta = agora.getTime() - inicio.getTime();
  if (delta < 0) return 0;
  return Math.floor(delta / MS_HORA) + 1;
}
