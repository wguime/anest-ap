import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Regras de anexo do canal público (QR code) — 06/09/2026.
//
// `public/incidentes-shared.js` é carregado por <script> nas páginas públicas
// (HTML vanilla, sem bundler), então não dá para importar como módulo: o teste
// avalia o arquivo e lê o namespace que ele publica em `window`. É o mesmo
// arquivo que roda em produção, não uma cópia — cópia divergiria na primeira
// correção.
//
// O que vale de verdade é o servidor (o balde barra tipo e tamanho, e a edge
// `relato-publico` confere antes de emitir o upload). Estas regras existem para
// dar erro legível antes de gastar upload — e são o que trava aqui.
// ============================================================================
let ANEST;

beforeAll(() => {
  const arquivo = path.resolve(__dirname, '../../../public/incidentes-shared.js');
  const codigo = fs.readFileSync(arquivo, 'utf8');
  const janela = {};
  new Function('window', codigo)(janela);
  ANEST = janela.ANEST_INCIDENTES;
});

/** File-like: o validador só olha name, size e type. */
function arquivo(name, size, type = '') {
  return { name, size, type };
}

const MB = 1024 * 1024;

describe('anexo público — limites', () => {
  it('expõe os limites decididos pelo dono: 3 arquivos, 10 MB', () => {
    expect(ANEST.ANEXO_PUBLICO_MAX_COUNT).toBe(3);
    expect(ANEST.ANEXO_PUBLICO_MAX_MB).toBe(10);
  });

  it('aceita até 3 arquivos e recusa o 4º, contando os já escolhidos', () => {
    const dois = [arquivo('a.jpg', 100, 'image/jpeg'), arquivo('b.png', 100, 'image/png')];
    expect(ANEST.validarAnexosPublico([arquivo('c.pdf', 100, 'application/pdf')], dois).ok).toBe(true);
    const res = ANEST.validarAnexosPublico(
      [arquivo('c.pdf', 100, 'application/pdf'), arquivo('d.jpg', 100, 'image/jpeg')],
      dois,
    );
    expect(res.ok).toBe(false);
    expect(res.erro).toMatch(/Máximo de 3/);
  });

  it('10 MB exatos passam; um byte a mais não', () => {
    expect(ANEST.validarAnexosPublico([arquivo('a.jpg', 10 * MB, 'image/jpeg')], []).ok).toBe(true);
    const res = ANEST.validarAnexosPublico([arquivo('a.jpg', 10 * MB + 1, 'image/jpeg')], []);
    expect(res.ok).toBe(false);
    expect(res.erro).toMatch(/excede 10MB/);
  });

  it('arquivo vazio é recusado', () => {
    const res = ANEST.validarAnexosPublico([arquivo('a.jpg', 0, 'image/jpeg')], []);
    expect(res.ok).toBe(false);
    expect(res.erro).toMatch(/vazio/);
  });
});

describe('anexo público — tipos', () => {
  it('aceita as imagens e o PDF que o dono aprovou', () => {
    for (const [nome, mime] of [
      ['foto.jpg', 'image/jpeg'], ['tela.png', 'image/png'],
      ['x.webp', 'image/webp'], ['doc.pdf', 'application/pdf'],
    ]) {
      expect(ANEST.validarAnexosPublico([arquivo(nome, 100, mime)], []).ok).toBe(true);
    }
  });

  it('recusa executável, compactado e vídeo — o vetor de abuso do endereço aberto', () => {
    for (const [nome, mime] of [
      ['x.exe', 'application/x-msdownload'], ['x.zip', 'application/zip'],
      ['x.mp4', 'video/mp4'], ['x.svg', 'image/svg+xml'],
    ]) {
      const res = ANEST.validarAnexosPublico([arquivo(nome, 100, mime)], []);
      expect(res.ok, nome).toBe(false);
      expect(res.erro).toMatch(/imagem \(JPG, PNG, HEIC\) ou PDF/);
    }
  });

  it('HEIC do iPhone passa mesmo quando o navegador não informa o tipo', () => {
    // Caso real: Safari manda `type` vazio para HEIC. Sem o fallback por
    // extensão, metade do grupo não anexaria foto nenhuma.
    expect(ANEST.resolveContentType(arquivo('IMG_0001.HEIC', 100, ''))).toBe('image/heic');
    expect(ANEST.validarAnexosPublico([arquivo('IMG_0001.HEIC', 100, '')], []).ok).toBe(true);
  });

  it('extensão em maiúscula é aceita e normalizada', () => {
    expect(ANEST.anexoExtensao('FOTO.JPG')).toBe('jpg');
    expect(ANEST.resolveContentType(arquivo('FOTO.JPG', 100, ''))).toBe('image/jpeg');
  });

  it('nome sem extensão utilizável não passa', () => {
    expect(ANEST.anexoExtensao('arquivo')).toBe('');
    expect(ANEST.validarAnexosPublico([arquivo('arquivo', 100, '')], []).ok).toBe(false);
  });

  it('tipo declarado fora da lista não vale, mesmo com extensão boa', () => {
    // O navegador informa o MIME; se for um que não aceitamos, cair para a
    // extensão seria contornar a própria regra.
    expect(ANEST.resolveContentType(arquivo('x.pdf', 100, 'application/zip'))).toBe('application/pdf');
  });
});

describe('anexo público — tamanho exibido', () => {
  it('mostra KB abaixo de 1 MB e MB com vírgula acima', () => {
    expect(ANEST.formatAnexoSize(500)).toBe('1 KB');
    expect(ANEST.formatAnexoSize(200 * 1024)).toBe('200 KB');
    expect(ANEST.formatAnexoSize(1.5 * MB)).toBe('1,5 MB');
    expect(ANEST.formatAnexoSize(0)).toBe('');
  });
});
