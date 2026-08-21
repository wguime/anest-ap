/**
 * E2E de LAYOUT da coluna de ações do card da fila (Liberações).
 *
 * Existe porque em 30/07 duas mudanças de POSIÇÃO foram para produção com a suíte
 * verde e o card quebrado: jsdom não mede layout, então "badge acima dos controles"
 * e "não vaza da tela" não são verificáveis em teste de unidade. Aqui mede-se
 * geometria de verdade a 375px.
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';
const DEMO_TIME = new Date('2026-06-26T14:00:00-03:00');

test.use({ viewport: { width: 375, height: 812 } });

test('tempo e "Editar" empilhados à direita, alinhados, sem vazar da tela', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  await page.clock.setFixedTime(DEMO_TIME);
  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await expect(page.getByText(/Demonstração — alterações/)).toBeVisible({ timeout: 15_000 });
  const tab = page.getByRole('tab', { name: 'Liberações' });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  const card = page.locator('[data-linha]').first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  // 1. COLUNA À DIREITA (dono 21/08): o tempo em cima, "Editar" no canto INFERIOR
  //    direito — empilhados, não lado a lado —, e os dois com a MESMA margem da
  //    borda do card. Era a geometria oposta até 20/08 (uma linha só); a medida
  //    aqui é o que impede a volta silenciosa, porque jsdom não mede layout.
  const badge = card.getByRole('button', { name: /Definir tempo faltante|toque para ajustar/ }).first();
  const editar = card.getByRole('button', { name: /^Editar local\/cirurgião/ });
  const [bBadge, bEditar, bCard] = [
    await badge.boundingBox(), await editar.boundingBox(), await card.boundingBox(),
  ];
  expect(bBadge && bEditar).toBeTruthy();
  // ⚠️ mede-se o BADGE, não o botão: o botão tem 44px de alvo com margem negativa
  // e transborda a própria caixa de propósito (mesmo truque do selo P4 — toque
  // confortável sem esticar 17 cards). Comparar as caixas dos BOTÕES acusaria
  // sobreposição onde a tela mostra dois elementos empilhados.
  const bPill = (await editar.locator('span').first().boundingBox())!;
  // empilhados: o tempo termina ANTES de o "Editar" começar
  expect(bBadge!.y + bBadge!.height).toBeLessThanOrEqual(bPill.y + 1);
  // e o "Editar" é o último elemento do card (canto inferior direito)
  expect(bPill.y + bPill.height).toBeLessThanOrEqual(bCard!.y + bCard!.height + 1);
  // mesma margem da borda direita, para os dois lerem como uma coluna só
  const recuo = (b: { x: number; width: number }) => Math.round(bCard!.x + bCard!.width - (b.x + b.width));
  expect(recuo(bPill)).toBe(recuo(bBadge!));
  // "Editar" diz a palavra — o lápis sozinho não dizia o que abria (dono 21/08)
  expect((await editar.textContent())?.trim()).toBe('Editar');

  // 2. NADA do card passa da largura da tela — foi o estrago de 30/07
  expect(bCard!.x + bCard!.width).toBeLessThanOrEqual(375);
  for (const el of await card.locator('button').all()) {
    const b = await el.boundingBox();
    if (b) expect(b.x + b.width).toBeLessThanOrEqual(375);
  }

  // LIMITE CONHECIDO: as setas de ordem da AJUDA não são exercitadas aqui — a
  // fixture demo não tem nome em azul (`ajudaExterna`), então elas nunca renderizam
  // neste caminho. A geometria verificada é a do badge × controles, que é onde as
  // duas quebras de 30/07 aconteceram.

  // 3. o nome do anestesista não é esmagado a uma palavra por linha (o sintoma)
  const nome = card.locator('p, span').filter({ hasText: /\w{3,}/ }).first();
  const bNome = await nome.boundingBox();
  expect(bNome!.width).toBeGreaterThan(80);
});
