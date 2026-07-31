/**
 * Parser do docx da escala mensal das funcionárias.
 * O fixture principal é um ROUNDTRIP: linhas construídas a partir dos dados
 * reais de ago/2026 dos data files → parse → deve devolver exatamente os
 * mesmos mapas, com zero issues.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  extrairLinhasDocx,
  parseEscalaFuncionarias,
  validarEscalaFuncionarias,
  resolverFuncionaria,
} from '../../lib/escalaFuncionariasDocx';
import { SOBREAVISO_MATERNO_2026, FUNCIONARIAS_SOBREAVISO } from '../../data/sobreavisoMaterno2026';
import { HOSPITAIS_2026 } from '../../data/hospitaisTecnicas2026';

const MES = '2026-08';
const DIAS_PT = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];

/** Linhas de ago/2026 no formato da tabela do docx, derivadas dos data files. */
function linhasAgosto() {
  const nomePorId = Object.fromEntries(FUNCIONARIAS_SOBREAVISO.map((f) => [f.id, f.nome]));
  const linhas = [['DATA', 'DIA', 'SOBREAVISO', 'UNIMED (07-15)', 'HRO (07-15)', 'PLANTÃO PAGO (15-23)', 'FERIADO']];
  for (let d = 1; d <= 31; d++) {
    const key = `${MES}-${String(d).padStart(2, '0')}`;
    const data = `${String(d).padStart(2, '0')}/08/2026`;
    const dia = DIAS_PT[new Date(2026, 7, d).getDay()];
    const hosp = HOSPITAIS_2026[key];
    linhas.push([
      data,
      dia,
      nomePorId[SOBREAVISO_MATERNO_2026[key]],
      hosp?.unimed || '—',
      hosp?.hro || '—',
      hosp?.plantaoPago || '—',
      hosp?.label || '',
    ]);
  }
  return linhas;
}

const agostoEsperado = (mapa) =>
  Object.fromEntries(Object.entries(mapa).filter(([k]) => k.startsWith(MES)));

describe('parseEscalaFuncionarias — roundtrip ago/2026', () => {
  const result = parseEscalaFuncionarias(linhasAgosto());

  it('zero issues e mês único', () => {
    expect(result.issues).toEqual([]);
    expect(result.mes).toBe(MES);
  });

  it('sobreaviso idêntico ao data file (31 dias, ids lowercase)', () => {
    expect(result.sobreaviso).toEqual(agostoEsperado(SOBREAVISO_MATERNO_2026));
  });

  it('hospitais idêntico ao data file (11 dias, nomes canônicos + label do feriado)', () => {
    expect(result.hospitais).toEqual(agostoEsperado(HOSPITAIS_2026));
    expect(result.hospitais['2026-08-25'].label).toBe('DIA DO MUNICÍPIO');
    expect(result.hospitais['2026-08-02'].unimed).toBeNull(); // domingo: '—' vira null
  });
});

describe('parseEscalaFuncionarias — validações', () => {
  it('typo "Sayonara" vira aviso fuzzy com sugestaoId, nunca auto-corrige', () => {
    const linhas = linhasAgosto();
    linhas[3][2] = 'Sayonara'; // 03/08, sobreaviso
    const r = parseEscalaFuncionarias(linhas);
    const aviso = r.avisos.find((a) => a.tipo === 'nome-fuzzy');
    expect(aviso).toMatchObject({ dateKey: '2026-08-03', campo: 'sobreaviso', valorLido: 'Sayonara', sugestaoId: 'saionara' });
    expect(r.sobreaviso['2026-08-03']).toBeUndefined(); // dia fica vazio (bloqueado pela issue)
    expect(r.issues.some((i) => i.dateKey === '2026-08-03' && i.tipo === 'sobreaviso-vazio')).toBe(true);
  });

  it('nome sem candidato próximo vira issue bloqueante', () => {
    const linhas = linhasAgosto();
    linhas[5][2] = 'Fernanda';
    const r = parseEscalaFuncionarias(linhas);
    expect(r.issues.some((i) => i.tipo === 'nome-desconhecido' && i.dateKey === '2026-08-05')).toBe(true);
    expect(r.avisos.some((a) => a.tipo === 'nome-fuzzy' && a.dateKey === '2026-08-05')).toBe(false);
  });

  it('sobreaviso vazio é issue', () => {
    const linhas = linhasAgosto();
    linhas[7][2] = '';
    const r = parseEscalaFuncionarias(linhas);
    expect(r.issues.some((i) => i.tipo === 'sobreaviso-vazio' && i.dateKey === '2026-08-07')).toBe(true);
  });

  it('dia ausente da tabela é issue (mês incompleto)', () => {
    const linhas = linhasAgosto();
    linhas.splice(14, 1); // remove 14/08
    const r = parseEscalaFuncionarias(linhas);
    expect(r.issues.some((i) => i.tipo === 'dia-faltando' && i.dateKey === '2026-08-14')).toBe(true);
  });

  it('sábado sem HRO/PP/UNIMED gera as 3 issues de slot', () => {
    const linhas = linhasAgosto();
    linhas[1][3] = '—'; linhas[1][4] = ''; linhas[1][5] = '—'; // 01/08 sábado
    const r = parseEscalaFuncionarias(linhas);
    expect(r.issues.some((i) => i.tipo === 'hospital-vazio' && i.dateKey === '2026-08-01')).toBe(true);
  });

  it('UNIMED preenchida em domingo é aviso, não issue', () => {
    const linhas = linhasAgosto();
    linhas[2][3] = 'Marta'; // 02/08 domingo
    const r = parseEscalaFuncionarias(linhas);
    expect(r.issues).toEqual([]);
    expect(r.avisos.some((a) => a.tipo === 'unimed-domingo' && a.dateKey === '2026-08-02')).toBe(true);
    expect(r.hospitais['2026-08-02'].unimed).toBe('Marta');
  });

  it('feriado desconhecido em dia útil: aviso + linha tratada como dia de hospital', () => {
    const linhas = linhasAgosto();
    linhas[12][6] = 'FERIADO SURPRESA'; // 12/08 quarta
    linhas[12][3] = 'Marta'; linhas[12][4] = 'Renata'; linhas[12][5] = 'Mari';
    const r = parseEscalaFuncionarias(linhas);
    expect(r.avisos.some((a) => a.tipo === 'feriado-desconhecido' && a.dateKey === '2026-08-12')).toBe(true);
    expect(r.hospitais['2026-08-12']).toEqual({ unimed: 'Marta', hro: 'Renata', plantaoPago: 'Mari', label: 'FERIADO SURPRESA' });
    expect(r.issues).toEqual([]);
  });

  it('duas escalas de meses diferentes no arquivo é issue', () => {
    const linhas = linhasAgosto();
    linhas.push(['01/09/2026', 'TERÇA', 'Marta', '—', '—', '—', '']);
    const r = parseEscalaFuncionarias(linhas);
    expect(r.issues.some((i) => i.tipo === 'multi-mes')).toBe(true);
    expect(r.mes).toBeNull();
  });

  it('nome exato aceita id, nome e caixa diferente', () => {
    expect(resolverFuncionaria('SAIONARA')).toEqual({ id: 'saionara', nome: 'Saionara' });
    expect(resolverFuncionaria('mari')).toEqual({ id: 'mari', nome: 'Mari' });
    expect(resolverFuncionaria('—')).toBeNull();
    expect(resolverFuncionaria('')).toBeNull();
  });
});

describe('validarEscalaFuncionarias — revalidação do estado editado', () => {
  it('estado completo de ago/2026 não tem issues', () => {
    const { issues } = validarEscalaFuncionarias(
      agostoEsperado(SOBREAVISO_MATERNO_2026), agostoEsperado(HOSPITAIS_2026), MES
    );
    expect(issues).toEqual([]);
  });

  it('apagar o HRO de um sábado volta a ser issue', () => {
    const hosp = structuredClone(agostoEsperado(HOSPITAIS_2026));
    hosp['2026-08-01'].hro = null;
    const { issues } = validarEscalaFuncionarias(agostoEsperado(SOBREAVISO_MATERNO_2026), hosp, MES);
    expect(issues.some((i) => i.tipo === 'hro-faltando' && i.dateKey === '2026-08-01')).toBe(true);
  });

  it('apagar um sobreaviso volta a ser issue', () => {
    const sobre = { ...agostoEsperado(SOBREAVISO_MATERNO_2026) };
    delete sobre['2026-08-20'];
    const { issues } = validarEscalaFuncionarias(sobre, agostoEsperado(HOSPITAIS_2026), MES);
    expect(issues.some((i) => i.tipo === 'sobreaviso-vazio' && i.dateKey === '2026-08-20')).toBe(true);
  });
});

describe('extrairLinhasDocx — docx real gerado em memória', () => {
  it('lê a tabela de um docx mínimo (células com runs divididos)', async () => {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    // "Sai" + "onara" em runs separados — simula o Word dividindo a palavra
    const cell = (t) => `<w:tc><w:p><w:r><w:t>${esc(t.slice(0, 3))}</w:t></w:r><w:r><w:t>${esc(t.slice(3))}</w:t></w:r></w:p></w:tc>`;
    const row = (cells) => `<w:tr>${cells.map(cell).join('')}</w:tr>`;
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>
${row(['DATA', 'DIA', 'SOBREAVISO', 'UNIMED (07-15)', 'HRO (07-15)', 'PLANTÃO PAGO (15-23)', 'FERIADO'])}
${row(['01/08/2026', 'SÁBADO', 'Elisete', 'Elisete', 'Saionara', 'Luciana', ''])}
</w:tbl></w:body></w:document>`;
    const zip = new JSZip();
    zip.file('word/document.xml', xml);
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const linhas = await extrairLinhasDocx(buffer);
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toEqual(['01/08/2026', 'SÁBADO', 'Elisete', 'Elisete', 'Saionara', 'Luciana', '']);
  });

  it('arquivo que não é docx rejeita com mensagem clara', async () => {
    const zip = new JSZip();
    zip.file('qualquer.txt', 'nada');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    await expect(extrairLinhasDocx(buffer)).rejects.toThrow(/docx/);
  });
});
