/**
 * Importação in-app da escala mensal das funcionárias — caminho real:
 * upload de um docx VERDADEIRO (gerado em memória) → parser → conferência →
 * publicar em escalasFuncionarias/{mes} (service mockado).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JSZip from 'jszip';

import { ThemeProvider, ToastProvider } from '@/design-system';
import ImportarEscalaFuncionariasPage from '@/pages/escalas-funcionarias/ImportarEscalaFuncionariasPage';
import { SOBREAVISO_MATERNO_2026, FUNCIONARIAS_SOBREAVISO } from '@/data/sobreavisoMaterno2026';
import { HOSPITAIS_2026 } from '@/data/hospitaisTecnicas2026';

const { getEscalaMes, publicarEscalaMes } = vi.hoisted(() => ({
  getEscalaMes: vi.fn(async () => ({ data: null, error: null })),
  publicarEscalaMes: vi.fn(async () => ({ success: true, error: null })),
}));
vi.mock('@/services/escalasFuncionariasService', () => ({ getEscalaMes, publicarEscalaMes }));
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-admin', isAdmin: true }, firebaseUser: { uid: 'u-admin' } }),
}));
vi.mock('@/hooks/useSobreavisoMaterno', () => ({
  useSobreavisoMaterno: () => ({ canEdit: true }),
}));

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>;

const MES = '2026-08';
const DIAS_PT = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const agostoDe = (mapa) => Object.fromEntries(Object.entries(mapa).filter(([k]) => k.startsWith(MES)));

/** Docx real de ago/2026 construído a partir dos data files (roundtrip). */
async function docxAgosto(mutar = (linhas) => linhas) {
  const nomePorId = Object.fromEntries(FUNCIONARIAS_SOBREAVISO.map((f) => [f.id, f.nome]));
  let linhas = [['DATA', 'DIA', 'SOBREAVISO', 'UNIMED (07-15)', 'HRO (07-15)', 'PLANTÃO PAGO (15-23)', 'FERIADO']];
  for (let d = 1; d <= 31; d++) {
    const key = `${MES}-${String(d).padStart(2, '0')}`;
    const hosp = HOSPITAIS_2026[key];
    linhas.push([
      `${String(d).padStart(2, '0')}/08/2026`,
      DIAS_PT[new Date(2026, 7, d).getDay()],
      nomePorId[SOBREAVISO_MATERNO_2026[key]],
      hosp?.unimed || '—',
      hosp?.hro || '—',
      hosp?.plantaoPago || '—',
      hosp?.label || '',
    ]);
  }
  linhas = mutar(linhas);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const row = (cells) => `<w:tr>${cells.map((t) => `<w:tc><w:p><w:r><w:t>${esc(t)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${linhas.map(row).join('')}</w:tbl></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('word/document.xml', xml);
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([buffer], 'Escala 2026-08.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

async function importar(file) {
  const onClose = vi.fn();
  const { container } = render(<ImportarEscalaFuncionariasPage onClose={onClose} />, { wrapper: wrap });
  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText(/Sobreaviso materno — agosto\/2026/)).toBeInTheDocument(), { timeout: 5000 });
  return { container, onClose };
}

const botaoPublicar = () => screen.getByRole('button', { name: /Publicar agosto\/2026/ });

beforeEach(() => {
  getEscalaMes.mockClear();
  getEscalaMes.mockResolvedValue({ data: null, error: null });
  publicarEscalaMes.mockClear();
  publicarEscalaMes.mockResolvedValue({ success: true, error: null });
});

describe('ImportarEscalaFuncionariasPage', () => {
  it('docx completo: conferência sem pendências e publicação com o shape exato', async () => {
    const { onClose } = await importar(await docxAgosto());

    expect(screen.queryByText(/impede(m)? a publicação/)).toBeNull();
    expect(botaoPublicar()).toBeEnabled();

    fireEvent.click(botaoPublicar());
    await waitFor(() => expect(publicarEscalaMes).toHaveBeenCalledTimes(1));

    const [mes, dados, userId] = publicarEscalaMes.mock.calls[0];
    expect(mes).toBe(MES);
    expect(userId).toBe('u-admin');
    expect(dados.sobreaviso).toEqual(agostoDe(SOBREAVISO_MATERNO_2026));
    expect(dados.hospitais).toEqual(agostoDe(HOSPITAIS_2026));
    expect(dados.arquivoNome).toBe('Escala 2026-08.docx');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('typo "Sayonara": publicar bloqueado até aplicar a sugestão pelo botão', async () => {
    await importar(await docxAgosto((linhas) => {
      linhas[3][2] = 'Sayonara'; // 03/08, sobreaviso
      return linhas;
    }));

    expect(screen.getByText(/impede a publicação/)).toBeInTheDocument();
    expect(botaoPublicar()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Usar Saionara/ }));
    await waitFor(() => expect(botaoPublicar()).toBeEnabled());

    fireEvent.click(botaoPublicar());
    await waitFor(() => expect(publicarEscalaMes).toHaveBeenCalledTimes(1));
    expect(publicarEscalaMes.mock.calls[0][1].sobreaviso['2026-08-03']).toBe('saionara');
  });

  it('mês já publicado: ConfirmDialog antes de substituir', async () => {
    getEscalaMes.mockResolvedValue({ data: { mes: MES, totais: { sobreaviso: 31, hospitais: 11 } }, error: null });
    await importar(await docxAgosto());

    fireEvent.click(botaoPublicar());
    await waitFor(() => expect(screen.getByText(/Substituir a escala de agosto\/2026\?/)).toBeInTheDocument());
    expect(publicarEscalaMes).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Substituir mês/ }));
    await waitFor(() => expect(publicarEscalaMes).toHaveBeenCalledTimes(1));
  });
});
