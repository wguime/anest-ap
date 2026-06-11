/**
 * Tests for src/utils/comunicadosHelpers.js
 *
 * Funções puras de apresentação/contagem usadas por ComunicadosPage,
 * ComunicadosCard (widget Home) e ComunicadosMonitorTab.
 * Datas relativas e prazos usam vi.setSystemTime (mesmo padrão de
 * dateUtils.test.js) para asserções determinísticas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calcularTotalDestinatarios,
  tipoColors,
  getTipoColor,
  ROLES_DESTINATARIOS,
  ROP_AREAS,
  STATUS_COMUNICADO,
  formatRelativeDate,
  formatFullDate,
  formatCardDate,
  formatEventDate,
  getFileIcon,
  isPrazoVencido,
  isExpirado,
  tiposComunicado,
} from '../../utils/comunicadosHelpers';
import { formatDate } from '../../utils/formatters';

// Freeze time (padrão de dateUtils.test.js) — meio-dia local, longe de
// boundary UTC/DST.
function freezeAt(localIsoLike) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(localIsoLike));
}

const makeUsers = () => [
  { uid: 'u1', role: 'anestesiologista' },                 // active undefined → ativo
  { uid: 'u2', role: 'anestesiologista', active: true },
  { uid: 'u3', role: 'medico-residente', active: true },
  { uid: 'u4', role: 'enfermeiro', active: false },        // inativo
  { uid: 'u5', role: 'secretaria', active: true },
];

// ===========================================================================
// calcularTotalDestinatarios
// ===========================================================================
describe('comunicadosHelpers.calcularTotalDestinatarios', () => {
  it('comunicado sem público (destinatarios ausente) → todos os ativos', () => {
    expect(calcularTotalDestinatarios({}, makeUsers())).toBe(4);
  });

  it('comunicado com destinatarios: [] (vazio) → todos os ativos', () => {
    expect(calcularTotalDestinatarios({ destinatarios: [] }, makeUsers())).toBe(4);
  });

  it('filtra por um role', () => {
    expect(
      calcularTotalDestinatarios({ destinatarios: ['anestesiologista'] }, makeUsers())
    ).toBe(2);
  });

  it('filtra por múltiplos roles', () => {
    expect(
      calcularTotalDestinatarios(
        { destinatarios: ['anestesiologista', 'medico-residente'] },
        makeUsers()
      )
    ).toBe(3);
  });

  it('user inativo do role alvo não conta', () => {
    expect(
      calcularTotalDestinatarios({ destinatarios: ['enfermeiro'] }, makeUsers())
    ).toBe(0);
  });

  it('role sem nenhum user → 0', () => {
    expect(
      calcularTotalDestinatarios({ destinatarios: ['farmaceutico'] }, makeUsers())
    ).toBe(0);
  });

  it('users vazio → 0 (com e sem público)', () => {
    expect(calcularTotalDestinatarios({}, [])).toBe(0);
    expect(calcularTotalDestinatarios({ destinatarios: ['enfermeiro'] }, [])).toBe(0);
  });

  it('users omitido (default param) → 0', () => {
    expect(calcularTotalDestinatarios({})).toBe(0);
  });
});

// ===========================================================================
// getTipoColor / tipoColors
// ===========================================================================
describe('comunicadosHelpers.getTipoColor', () => {
  it('retorna a cor de cada tipo conhecido', () => {
    expect(getTipoColor('Urgente')).toBe('#dc2626');
    expect(getTipoColor('Importante')).toBe('#f59e0b');
    expect(getTipoColor('Informativo')).toBe('#3b82f6');
    expect(getTipoColor('Evento')).toBe('#9333ea');
    expect(getTipoColor('Geral')).toBe('#6b7280');
  });

  it('tipo desconhecido / undefined / case errado caem em Geral', () => {
    expect(getTipoColor('Inexistente')).toBe(tipoColors['Geral']);
    expect(getTipoColor(undefined)).toBe(tipoColors['Geral']);
    expect(getTipoColor('urgente')).toBe(tipoColors['Geral']); // lookup é case-sensitive
  });

  it('tipoColors cobre exatamente os 5 tipos', () => {
    expect(Object.keys(tipoColors).sort()).toEqual(
      ['Evento', 'Geral', 'Importante', 'Informativo', 'Urgente']
    );
  });
});

// ===========================================================================
// Constantes (shape, sem snapshot frágil)
// ===========================================================================
describe('comunicadosHelpers — constantes', () => {
  it('ROLES_DESTINATARIOS: 8 roles com key/label string e keys únicas', () => {
    expect(ROLES_DESTINATARIOS).toHaveLength(8);
    for (const role of ROLES_DESTINATARIOS) {
      expect(typeof role.key).toBe('string');
      expect(typeof role.label).toBe('string');
      expect(role.key.length).toBeGreaterThan(0);
    }
    const keys = ROLES_DESTINATARIOS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('anestesiologista');
    expect(keys).toContain('medico-residente');
  });

  it('ROP_AREAS: 7 áreas (geral + ROP 1–6) com key/label/color', () => {
    expect(ROP_AREAS).toHaveLength(7);
    for (const area of ROP_AREAS) {
      expect(typeof area.key).toBe('string');
      expect(typeof area.label).toBe('string');
      expect(area.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(ROP_AREAS[0].key).toBe('geral');
  });

  it('STATUS_COMUNICADO: rascunho → aprovado → publicado', () => {
    expect(STATUS_COMUNICADO.map((s) => s.key)).toEqual([
      'rascunho',
      'aprovado',
      'publicado',
    ]);
    for (const status of STATUS_COMUNICADO) {
      expect(typeof status.label).toBe('string');
      expect(status.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('tiposComunicado: 5 tipos, cores consistentes com tipoColors', () => {
    expect(tiposComunicado).toHaveLength(5);
    for (const tipo of tiposComunicado) {
      expect(tipo.color).toBe(tipoColors[tipo.value]);
      expect(typeof tipo.label).toBe('string');
    }
  });
});

// ===========================================================================
// formatRelativeDate (fake timers)
// ===========================================================================
describe('comunicadosHelpers.formatRelativeDate', () => {
  beforeEach(() => freezeAt('2026-06-10T12:00:00'));
  afterEach(() => vi.useRealTimers());

  it('agora mesmo → "há 0 min"', () => {
    expect(formatRelativeDate('2026-06-10T12:00:00')).toBe('há 0 min');
  });

  it('< 60 min → "há N min"', () => {
    expect(formatRelativeDate('2026-06-10T11:55:00')).toBe('há 5 min');
    expect(formatRelativeDate('2026-06-10T11:01:00')).toBe('há 59 min');
  });

  it('1 hora exata → singular "há 1 hora"', () => {
    expect(formatRelativeDate('2026-06-10T11:00:00')).toBe('há 1 hora');
  });

  it('2–23 horas → plural "há N horas"', () => {
    expect(formatRelativeDate('2026-06-10T09:00:00')).toBe('há 3 horas');
    expect(formatRelativeDate('2026-06-09T12:30:00')).toBe('há 23 horas');
  });

  it('24–47h atrás → "ontem"', () => {
    expect(formatRelativeDate('2026-06-09T12:00:00')).toBe('ontem');
    expect(formatRelativeDate('2026-06-08T12:30:00')).toBe('ontem');
  });

  it('2 a 6 dias → "há N dias"', () => {
    expect(formatRelativeDate('2026-06-08T12:00:00')).toBe('há 2 dias');
    expect(formatRelativeDate('2026-06-04T11:00:00')).toBe('há 6 dias');
  });

  it('≥ 7 dias → cai para formatDate dayMonth (ex.: "03 de jun.")', () => {
    const old = '2026-06-03T12:00:00';
    expect(formatRelativeDate(old)).toBe(formatDate(new Date(old), 'dayMonth'));
  });

  it('COMPORTAMENTO ATUAL (suspeita de bug): data futura gera minutos negativos', () => {
    // diffMs < 0 → diffMins negativo passa no `< 60` e produz "há -N min".
    // formatters.formatRelativeTime trata esse caso (diffMs < 0 → dayMonth);
    // este helper não. Anotado como bug real; teste trava o comportamento atual.
    expect(formatRelativeDate('2026-06-10T12:10:00')).toBe('há -10 min');
  });

  // Nota (sem teste possível): o branch `if (diffDays === 0) return 'hoje'`
  // é código morto — qualquer diff com diffDays === 0 tem diffHours < 24 e
  // retorna antes em "há N min"/"há N horas".
});

// ===========================================================================
// formatFullDate / formatCardDate / formatEventDate
// ===========================================================================
describe('comunicadosHelpers — formatadores de data absoluta', () => {
  const iso = '2026-03-15T14:30:00';

  it('formatFullDate → estilo long pt-BR (15 de março de 2026)', () => {
    const out = formatFullDate(iso);
    expect(out).toContain('15');
    expect(out).toContain('março');
    expect(out).toContain('2026');
    expect(out).toBe(formatDate(new Date(iso), 'long'));
  });

  it('formatCardDate → DD/MM/AAAA', () => {
    expect(formatCardDate(iso)).toBe('15/03/2026');
  });

  it('formatEventDate → dia + mês por extenso + ano + hora:minuto', () => {
    const out = formatEventDate(iso);
    expect(out).toContain('15');
    expect(out).toContain('março');
    expect(out).toContain('2026');
    expect(out).toContain('14:30');
  });
});

// ===========================================================================
// getFileIcon
// ===========================================================================
describe('comunicadosHelpers.getFileIcon', () => {
  it('documentos de texto → FileText', () => {
    expect(getFileIcon('protocolo.pdf')).toBe('FileText');
    expect(getFileIcon('ata.doc')).toBe('FileText');
    expect(getFileIcon('ata.docx')).toBe('FileText');
  });

  it('planilhas → Table; apresentações → Presentation', () => {
    expect(getFileIcon('kpi.xls')).toBe('Table');
    expect(getFileIcon('kpi.xlsx')).toBe('Table');
    expect(getFileIcon('aula.ppt')).toBe('Presentation');
    expect(getFileIcon('aula.pptx')).toBe('Presentation');
  });

  it('imagens → Image', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
      expect(getFileIcon(`foto.${ext}`)).toBe('Image');
    }
  });

  it('extensão maiúscula é normalizada', () => {
    expect(getFileIcon('PROTOCOLO.PDF')).toBe('FileText');
  });

  it('múltiplos pontos: usa a última extensão', () => {
    expect(getFileIcon('relatorio.final.v2.xlsx')).toBe('Table');
  });

  it('extensão desconhecida ou sem extensão → File', () => {
    expect(getFileIcon('script.zip')).toBe('File');
    expect(getFileIcon('README')).toBe('File');
  });
});

// ===========================================================================
// isPrazoVencido / isExpirado (fake timers)
// ===========================================================================
describe('comunicadosHelpers.isPrazoVencido / isExpirado', () => {
  beforeEach(() => freezeAt('2026-06-10T12:00:00'));
  afterEach(() => vi.useRealTimers());

  it('isPrazoVencido: prazo no passado → true', () => {
    expect(isPrazoVencido({ prazoConfirmacao: '2026-06-10T11:59:59' })).toBe(true);
    expect(isPrazoVencido({ prazoConfirmacao: '2026-01-01T00:00:00' })).toBe(true);
  });

  it('isPrazoVencido: prazo no futuro → false', () => {
    expect(isPrazoVencido({ prazoConfirmacao: '2026-06-10T12:00:01' })).toBe(false);
    expect(isPrazoVencido({ prazoConfirmacao: '2027-01-01T00:00:00' })).toBe(false);
  });

  it('isPrazoVencido: sem prazo (ausente/null/"") → false', () => {
    expect(isPrazoVencido({})).toBe(false);
    expect(isPrazoVencido({ prazoConfirmacao: null })).toBe(false);
    expect(isPrazoVencido({ prazoConfirmacao: '' })).toBe(false);
  });

  it('isExpirado: dataValidade passada → true; futura → false; ausente → false', () => {
    expect(isExpirado({ dataValidade: '2026-06-09T12:00:00' })).toBe(true);
    expect(isExpirado({ dataValidade: '2026-06-11T12:00:00' })).toBe(false);
    expect(isExpirado({})).toBe(false);
    expect(isExpirado({ dataValidade: null })).toBe(false);
  });
});
