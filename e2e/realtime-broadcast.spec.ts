/**
 * Realtime por Broadcast (16/09/2026) — verificação ponta a ponta com usuário REAL
 * contra o projeto de produção (o dev server usa .env.local):
 *
 *   1. ao abrir a escala, o app entra nos canais PRIVADOS `t:escala_cirurgica*`
 *      e no pessoal `u:notifications:<uid>` e o servidor responde `phx_reply`
 *      com status "ok" — ou seja, a policy `rt_sinal_select` de
 *      realtime.messages aceita o JWT do app;
 *   2. nenhum `[ReliableSubscription] … CHANNEL_ERROR/TIMED_OUT` no console;
 *   3. a policy é mesmo aplicada: entrar em `u:notifications:<OUTRO uid>` é
 *      recusado pelo servidor ("Unauthorized: You do not have permissions to read
 *      from this Channel topic"; o realtime-js 2.95 sinaliza como CLOSED) — feito
 *      pelo módulo do próprio app, `/src/config/supabase.js`, que o Vite serve em
 *      dev com o MESMO client já autenticado.
 *
 * Sem escrita: nada é gravado no banco. Roda com `npm run dev` de pé e
 * E2E_USER_EMAIL/E2E_USER_PASSWORD no ambiente (~/.anest-e2e.env, via `source`).
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

test.describe('Realtime Broadcast — canais privados', () => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  test('JOIN ok nos tópicos t:escala_* e no pessoal; outro uid é recusado; sem CHANNEL_ERROR', async ({ page }) => {
    const erros: string[] = [];
    page.on('console', (m) => {
      const t = m.text();
      if (/\[ReliableSubscription\]/.test(t) && /CHANNEL_ERROR|TIMED_OUT|max retries/.test(t)) erros.push(t);
    });

    // frames do Phoenix (vsn=2.0.0 → arrays [join_ref, ref, topic, event, payload])
    const joins = new Map<string, string>(); // topic → status da resposta
    const motivos = new Map<string, string>(); // topic → reason da recusa
    const refs = new Map<string, string>(); // ref → topic
    const parse = (raw: string | Buffer) => {
      try { return JSON.parse(String(raw)); } catch { return null; }
    };
    page.on('websocket', (ws) => {
      if (!/realtime\/v1\/websocket/.test(ws.url())) return;
      ws.on('framesent', (f) => {
        const m = parse(f.payload);
        if (!m) return;
        const [, ref, topic, event] = Array.isArray(m) ? m : [null, m.ref, m.topic, m.event];
        if (event === 'phx_join') { joins.set(topic, 'pedido'); refs.set(String(ref), topic); }
      });
      ws.on('framereceived', (f) => {
        const m = parse(f.payload);
        if (!m) return;
        const [, ref, topic, event, payload] = Array.isArray(m) ? m : [null, m.ref, m.topic, m.event, m.payload];
        if (event === 'phx_reply' && refs.get(String(ref)) === topic) {
          joins.set(topic, payload?.status || '?');
          if (payload?.status === 'error') motivos.set(topic, String(payload?.response?.reason || JSON.stringify(payload?.response || '')));
        }
      });
    });

    // Login (mesmo fluxo do auth.spec)
    await page.goto('/');
    await page.locator('input[autocomplete="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 30_000 });

    await page.goto('/escala-cirurgica');
    // tempo para o socket abrir e os JOINs responderem (token + join ≈ 1–3 s)
    await page.waitForTimeout(10_000);

    const escala = [...joins.entries()].filter(([t]) => t.startsWith('realtime:t:escala_cirurgica'));
    const pessoal = [...joins.entries()].filter(([t]) => t.startsWith('realtime:u:notifications:'));
    console.log('JOINs:', JSON.stringify([...joins.entries()]));
    expect(escala.length, 'o app deve entrar nos tópicos da escala').toBeGreaterThanOrEqual(2);
    for (const [topic, status] of escala) expect(status, topic).toBe('ok');
    expect(pessoal.length, 'o app deve entrar no tópico pessoal de notificações').toBe(1);
    expect(pessoal[0][1], pessoal[0][0]).toBe('ok');
    expect(erros, 'nenhum CHANNEL_ERROR/TIMED_OUT do helper').toEqual([]);

    // 3. policy aplicada: tópico pessoal de OUTRO uid tem de ser recusado.
    // Só em dev: o import por URL do módulo do app é coisa do Vite; contra a URL
    // publicada (E2E_BASE_URL) o bundle não expõe o client — os itens 1 e 2 já
    // provam o JOIN e a policy positiva.
    test.skip(!/localhost|127\.0\.0\.1/.test(String(page.url())), 'negativo só em dev (import por URL do Vite)');
    const statusOutro = await page.evaluate(async () => {
      const mod = await import('/src/config/supabase.js');
      const supabase = mod.supabase;
      return await new Promise<string>((resolve) => {
        const ch = supabase.channel('u:notifications:uid-que-nao-e-meu-e2e', { config: { private: true } });
        const t = setTimeout(() => { supabase.removeChannel(ch); resolve('TIMEOUT'); }, 15_000);
        ch.subscribe((s: string) => {
          if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'CLOSED') {
            clearTimeout(t); supabase.removeChannel(ch); resolve(s);
          }
        });
      });
    });
    const topicoOutro = 'realtime:u:notifications:uid-que-nao-e-meu-e2e';
    console.log('outro uid →', statusOutro, '| phx_reply:', joins.get(topicoOutro), '| motivo:', motivos.get(topicoOutro));
    // o realtime-js sinaliza a recusa como CHANNEL_ERROR ou CLOSED conforme a versão;
    // o que importa: nunca SUBSCRIBED e nenhum phx_reply "ok" para o tópico alheio
    expect(statusOutro, 'a policy de realtime.messages deve recusar o tópico de outro uid').not.toBe('SUBSCRIBED');
    expect(statusOutro).not.toBe('TIMEOUT');
    expect(joins.get(topicoOutro), 'o servidor deve responder ao JOIN alheio com erro').toBe('error');
  });
});
