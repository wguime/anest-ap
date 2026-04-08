import { describe, it, expect } from 'vitest';

/**
 * Testes unitários para as funções auxiliares da Edge Function notify-incident.
 *
 * Como a Edge Function roda em Deno, extraímos e testamos as funções
 * puras (escapeHtml, buildEmailHtml) diretamente.
 */

// ============================================================================
// Re-implementação local das funções puras da Edge Function para teste
// (mesma lógica de supabase/functions/notify-incident/index.ts)
// ============================================================================

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml(payload) {
  const isTipo = payload.tipo === 'incidente';
  const title = isTipo ? 'Nova Notificacao de Incidente' : 'Nova Denuncia Registrada';
  const color = isTipo ? '#006837' : '#DC2626';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:${color};padding:20px;text-align:center">
      <h1 style="color:white;margin:0;font-size:20px">${title}</h1>
    </div>
    <div style="padding:20px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:4px 8px;color:#666">Protocolo:</td><td style="padding:4px 8px;font-weight:bold;font-family:monospace;font-size:16px">${escapeHtml(payload.protocolo)}</td></tr>
        ${payload.categoria ? `<tr><td style="padding:4px 8px;color:#666">Categoria:</td><td style="padding:4px 8px">${escapeHtml(payload.categoria)}</td></tr>` : ''}
        ${payload.severidade ? `<tr><td style="padding:4px 8px;color:#666">Severidade:</td><td style="padding:4px 8px">${escapeHtml(payload.severidade)}</td></tr>` : ''}
      </table>
      ${payload.descricaoResumo ? `
        <div style="background:#f9fafb;padding:12px;border-radius:6px;border-left:4px solid ${color}">
          <p style="margin:0 0 4px;font-size:12px;color:#666">Descricao:</p>
          <p style="margin:0;font-size:14px;word-wrap:break-word;white-space:pre-wrap">${escapeHtml(payload.descricaoResumo)}</p>
        </div>
      ` : ''}
      <div style="margin-top:20px;text-align:center">
        <a href="https://anest-ap.web.app" style="display:inline-block;background:${color};color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          Acessar Sistema ANEST
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:12px;text-align:center;font-size:11px;color:#999">
      Este email foi gerado automaticamente pelo sistema ANEST. Nao responda a este email.
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// Tests
// ============================================================================
describe('notify-incident Edge Function — buildEmailHtml', () => {
  const LONG_TEXT = 'C'.repeat(1000);
  const TEXT_WITH_SPECIALS = 'Paciente <Maria> apresentou "reação" & necessitou O\'Brien protocol';
  const MULTILINE_TEXT = 'Linha 1: Paciente deu entrada.\nLinha 2: Observação do procedimento.\nLinha 3: Conclusão.';

  it('deve incluir descrição completa de 1000 chars no HTML', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      descricaoResumo: LONG_TEXT,
    });

    // O texto completo (escaped) deve estar presente
    expect(html).toContain(LONG_TEXT);
    expect(html.indexOf(LONG_TEXT)).toBeGreaterThan(-1);
  });

  it('deve escapar caracteres HTML especiais na descrição', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      descricaoResumo: TEXT_WITH_SPECIALS,
    });

    expect(html).toContain('&lt;Maria&gt;');
    expect(html).toContain('&quot;reação&quot;');
    expect(html).toContain('&amp;');
    expect(html).toContain('O&#39;Brien');
    // Não deve conter tags HTML não escapadas
    expect(html).not.toContain('<Maria>');
  });

  it('deve preservar quebras de linha com white-space:pre-wrap', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      descricaoResumo: MULTILINE_TEXT,
    });

    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('word-wrap:break-word');
    // O texto com \n deve estar presente (pre-wrap renderiza \n)
    expect(html).toContain('Linha 1: Paciente deu entrada.\nLinha 2:');
  });

  it('deve usar label "Descricao:" (sem "resumida")', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      descricaoResumo: 'Teste',
    });

    expect(html).toContain('Descricao:</p>');
    expect(html).not.toContain('Descricao resumida');
  });

  it('deve omitir seção de descrição quando vazia', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      descricaoResumo: '',
    });

    // String vazia é falsy → seção não renderiza
    expect(html).not.toContain('Descricao:</p>');
  });

  it('deve usar cor verde (#006837) para incidentes', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      descricaoResumo: 'Teste',
    });

    expect(html).toContain('background:#006837');
    expect(html).toContain('Nova Notificacao de Incidente');
  });

  it('deve usar cor vermelha (#DC2626) para denúncias', () => {
    const html = buildEmailHtml({
      tipo: 'denuncia',
      protocolo: 'DEN-20260408-0001',
      descricaoResumo: 'Teste',
    });

    expect(html).toContain('background:#DC2626');
    expect(html).toContain('Nova Denuncia Registrada');
  });

  it('deve incluir protocolo, categoria e severidade quando fornecidos', () => {
    const html = buildEmailHtml({
      tipo: 'incidente',
      protocolo: 'INC-20260408-0001',
      categoria: 'medicacao',
      severidade: 'grave',
      descricaoResumo: 'Teste',
    });

    expect(html).toContain('INC-20260408-0001');
    expect(html).toContain('medicacao');
    expect(html).toContain('grave');
  });
});

describe('escapeHtml', () => {
  it('deve escapar todos os 5 caracteres HTML perigosos', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('deve escapar aspas simples', () => {
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });

  it('deve escapar ampersand', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('deve retornar string vazia para input vazio', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('não deve alterar texto sem caracteres especiais', () => {
    const safe = 'Texto simples sem caracteres perigosos 123';
    expect(escapeHtml(safe)).toBe(safe);
  });
});
