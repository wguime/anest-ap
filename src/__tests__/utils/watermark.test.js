import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { applyWatermark, buildWatermarkLines } from '@/utils/watermark';

async function makeMinimalPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  page.drawText('Original content');
  return doc.save(); // Uint8Array
}

describe('applyWatermark', () => {
  it('retorna Uint8Array maior que o PDF original (texto adicionado aumenta tamanho)', async () => {
    const original = await makeMinimalPdf();
    const stamped = await applyWatermark(original, {
      text: 'CÓPIA NÃO CONTROLADA',
      subLines: ['João Silva', 'joao@anest.com.br', '2026-05-05T12:00:00Z'],
    });
    expect(stamped).toBeInstanceOf(Uint8Array);
    expect(stamped.length).toBeGreaterThan(original.length);
  });

  it('aplica watermark em PDF de múltiplas páginas (todas as páginas tratadas)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    doc.addPage([400, 600]);
    doc.addPage([400, 600]);
    const original = await doc.save();

    const stamped = await applyWatermark(original, { text: 'CÓPIA NÃO CONTROLADA' });
    // Recarrega o PDF marcado e confirma que ainda tem 3 páginas (pdf-lib não as removeu).
    const reloaded = await PDFDocument.load(stamped);
    expect(reloaded.getPageCount()).toBe(3);
    expect(stamped.length).toBeGreaterThan(original.length);
  });

  it('aceita opcoes opcionais (opacity, rotation, fontSize) e retorna PDF válido', async () => {
    const original = await makeMinimalPdf();
    const stamped = await applyWatermark(original, {
      text: 'CONFIDENCIAL',
      opacity: 0.3,
      rotation: -45,
      fontSize: 64,
    });
    // Valida que pdf-lib consegue recarregar (não corrompemos).
    const reloaded = await PDFDocument.load(stamped);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('lança erro descritivo quando pdfBytes é inválido', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(applyWatermark(garbage, { text: 'X' })).rejects.toThrow(
      /PDF inválido ou corrupto/,
    );
  });

  it('valida parâmetros obrigatórios (pdfBytes ausente, text ausente)', async () => {
    await expect(applyWatermark(null, { text: 'X' })).rejects.toThrow(/pdfBytes ausente/);
    const original = await makeMinimalPdf();
    await expect(applyWatermark(original, {})).rejects.toThrow(/text/);
  });
});

describe('buildWatermarkLines', () => {
  it('retorna array com todos os campos quando todos estão presentes', () => {
    const lines = buildWatermarkLines({
      name: 'Maria Souza',
      email: 'maria@anest.com.br',
      ip: '192.168.1.10',
      timestamp: '2026-05-05T10:00:00Z',
    });
    expect(Array.isArray(lines)).toBe(true);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('Maria Souza');
    expect(lines[1]).toBe('maria@anest.com.br');
    expect(lines[2]).toContain('192.168.1.10');
    expect(lines[3]).toBe('2026-05-05T10:00:00Z');
  });

  it('omite campos vazios/ausentes', () => {
    const lines = buildWatermarkLines({ name: 'Ana', email: '' });
    expect(lines).toEqual(['Ana']);
  });

  it('aceita Date e converte para ISO string', () => {
    const ts = new Date('2026-01-01T00:00:00Z');
    const lines = buildWatermarkLines({ timestamp: ts });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('2026-01-01T00:00:00.000Z');
  });

  it('retorna array vazio quando nenhum campo é fornecido', () => {
    expect(buildWatermarkLines()).toEqual([]);
    expect(buildWatermarkLines({})).toEqual([]);
  });
});
