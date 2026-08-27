/**
 * E2E: as ABAS de conferência do lote (dono 2026-08-27), no app real.
 *
 * A leitura da Vision é INTERCEPTADA (`page.route` na edge
 * `parse-escala-cirurgica`): o que se quer provar aqui é a tela — dois arquivos
 * soltos juntos viram duas abas, o selo diz o estado de cada hospital e a folha
 * de revisão lista os dois antes de publicar —, não a extração, que tem custo
 * por leitura e depende do crédito da conta.
 *
 * Pre-req: `npm run dev` de pé + E2E_USER_EMAIL/E2E_USER_PASSWORD no env.
 * Rodar:   npx playwright test e2e/importar-escalas-lote-abas.spec.ts --project=chromium
 *          E2E_COLOR_SCHEME=dark npx playwright test e2e/importar-escalas-lote-abas.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';
const SCHEME = process.env.E2E_COLOR_SCHEME === 'dark' ? 'dark' : 'light';
test.use({ viewport: { width: 430, height: 839 }, colorScheme: SCHEME });

const caso = (sala: string, anestesista: string, hora: string) => ({
  sala, anestesista, hora, procedimento: `CIRURGIA ${sala}`, cirurgiao: 'DR TESTE',
  pacienteIniciais: 'A.B.', convenio: 'UNIMED', ordem: 0, bloco: 'normal',
});

// Uma resposta por arquivo, na ordem em que forem lidos
const RESPOSTAS = [
  {
    hospitalDetectado: 'hro',
    dataDetectada: '',
    casos: [caso('Sala 1', 'CURY', '07:30'), caso('Sala 2', 'MARINA', '08:00')],
    ordemLiberacao: ['CURY', 'MARINA'],
    ajudaExterna: [],
    posicoesAssistenciais: [],
  },
  {
    hospitalDetectado: 'materno',
    dataDetectada: '',
    casos: [caso('Sala 1', 'PAULO', '09:00')],
    ordemLiberacao: ['PAULO'],
    ajudaExterna: [],
    posicoesAssistenciais: [],
  },
];

test('lote: dois arquivos, duas abas, selo por hospital e folha de revisão', async ({ page }) => {
  test.skip(!E2E_USER_EMAIL || !E2E_USER_PASSWORD, 'Set E2E_USER_EMAIL / E2E_USER_PASSWORD');
  test.setTimeout(120_000);

  let leitura = 0;
  await page.route('**/functions/v1/parse-escala-cirurgica', async (route) => {
    const corpo = RESPOSTAS[Math.min(leitura, RESPOSTAS.length - 1)];
    leitura += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });

  await page.goto('/');
  await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
  await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({ timeout: 20_000 });

  await page.goto('/escala-cirurgica');
  await page.getByRole('button', { name: /importar/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Confeccionar escalas' })).toBeVisible();

  // O turno é do LOTE e o filtro é pela HORA de cada caso: com a tarde
  // selecionada, cirurgias das 7h30 ficariam de fora (comportamento correto —
  // e foi o que este teste pegou na primeira execução). As fixtures são da
  // manhã, então o lote é matutino.
  // .last(): a tela da escala continua montada atrás do modal e também tem um
  // seletor de turno; o do lote é o que foi renderizado por último.
  await page.getByRole('tab', { name: 'Manhã' }).last().click();

  // dois arquivos de uma vez (PNGs reais — o preparo da imagem roda no browser)
  await page.locator('input[type="file"]').first().setInputFiles([
    '.tmp/e2e-lote-light.png',
    '.tmp/e2e-lote-dark.png',
  ]);

  const abas = page.getByRole('tablist', { name: /hospitais do lote/i }).getByRole('tab');
  await expect(abas).toHaveCount(2, { timeout: 30_000 });
  await expect(abas.nth(0)).toContainText('HRO');
  await expect(abas.nth(1)).toContainText('Materno');
  expect(leitura).toBe(2); // uma leitura por arquivo

  await page.screenshot({ path: `.tmp/e2e-abas-${SCHEME}.png` });

  // trocar de aba não pode perder a conferência do outro hospital
  const ajuda = page.getByPlaceholder(/vão ao fim da liberação/i).locator('visible=true');
  await ajuda.fill('DIEGO');
  await abas.nth(1).click();
  await abas.nth(0).click();
  await expect(page.getByPlaceholder(/vão ao fim da liberação/i).locator('visible=true')).toHaveValue('DIEGO');

  // o campo Sala é uma ESCOLHA das salas daquele hospital (dono 27/08)
  await page.getByRole('button', { name: /Sala 1/ }).first().click();
  const seletorSala = page.getByRole('combobox').filter({ hasText: /Sala 1|Escolher a sala/ }).first();
  await expect(seletorSala).toBeVisible();
  await page.screenshot({ path: `.tmp/e2e-bloco-${SCHEME}.png` });

  // folha de revisão: os dois hospitais antes de publicar
  await page.getByRole('button', { name: /revisar e publicar/i }).click();
  await expect(page.getByText('Revisar antes de publicar')).toBeVisible();
  const botaoPublicar = page.getByRole('button', { name: /publicar as 2|publicar a /i });
  await expect(botaoPublicar).toBeVisible();
  // a folha sobe animada: esperar ela assentar antes do retrato
  await expect(botaoPublicar).toBeInViewport();
  await page.screenshot({ path: `.tmp/e2e-folha-${SCHEME}.png` });
});
