/**
 * E2E: Quiz answer persistence offline → sync online
 *
 * Validates the offline-tolerant behaviour of the quiz attempt flow usando o
 * "Desafio do dia" das ROPs (Educação → Desafio ROPs → Desafio do dia):
 *   1. User opens the daily challenge while online (RPC server-side gera
 *      10 questões idempotentes por (user, dia UTC))
 *   2. Network goes offline
 *   3. User answers 2 questions — o submit por questão falha em silêncio
 *      (ROPsDesafioDiarioPage.handleAnswer trata erro como non-fatal/warn)
 *      e o estado do quiz persiste no client
 *   4. Network goes back online
 *   5. No error toast appears; quiz state (questão 2 respondida) remains
 *
 * Por que ROPs e não Educação Continuada: as trilhas/cursos dependem de
 * conteúdo publicado (data dependency frágil); o banco de questões ROPs é
 * seedado em produção (640 questões), então o caminho é estável.
 *
 * Pre-req:
 *   - `npx playwright install` (one-time)
 *   - dev server running: `npm run dev`
 *   - Test user com acesso ao card rops_desafio:
 *       E2E_USER_EMAIL, E2E_USER_PASSWORD
 *
 * Data dependencies (skip gracioso, não falha):
 *   - Desafio do dia já completado hoje pelo user e2e → tela "concluído"
 *   - Pool de questões insuficiente / erro de RPC
 *   - Card "Desafio ROPs" sem permissão para o user e2e
 *
 * Run:
 *   npm run e2e -- e2e/quiz-offline.spec.ts
 */
import { test, expect } from '@playwright/test';

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || '';
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || '';

test.describe('Quiz offline persistence', () => {
  test.skip(
    !E2E_USER_EMAIL || !E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL / E2E_USER_PASSWORD to run quiz specs',
  );

  test('answer 2 questions offline, then back online with no errors', async ({ page, context }) => {
    // --- Login (padrão canônico do auth.spec) ---
    await page.goto('/');
    await page.locator('input[type="email"]').first().fill(E2E_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).first().click();

    // NÃO usar waitForLoadState('networkidle'): a home mantém realtime aberto
    // e a rede nunca fica idle.
    await expect(page.getByRole('heading', { name: 'Página inicial' })).toBeVisible({
      timeout: 20_000,
    });

    // --- Bottom nav → Educação ---
    const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
    await bottomNav.getByRole('button', { name: 'Educação' }).click();
    // "Publicações" é o widget sempre presente (sem gate de permissão)
    await expect(page.getByRole('button', { name: /Publicações/ })).toBeVisible({
      timeout: 10_000,
    });

    // --- Widget "Desafio ROPs" (gated por canAccessCard('rops_desafio')) ---
    const ropsCard = page.getByRole('button', { name: /Desafio ROPs/ }).first();
    const hasRops = await ropsCard.isVisible().catch(() => false);
    test.skip(!hasRops, 'User e2e sem permissão para o card Desafio ROPs (rops_desafio)');
    await ropsCard.click();
    await expect(page.getByRole('heading', { name: 'Desafio das ROPs' })).toBeVisible({
      timeout: 10_000,
    });

    // --- CTA "Desafio do dia" → quiz de 10 questões ---
    await page.getByRole('button', { name: /Desafio do dia/ }).first().click();

    // A página resolve para um de 3 estados: quiz pronto | já concluído hoje |
    // erro de carga (pool insuficiente etc.). Esperamos qualquer um e tratamos.
    const quiz = page.getByRole('group', { name: 'Quiz Qmentum' });
    const completedState = page.getByText('Desafio do dia concluído!');
    const errorState = page.getByText(/Desafio indisponível|Não foi possível carregar o desafio|Banco de questões insuficiente/);
    await expect(quiz.or(completedState).or(errorState).first()).toBeVisible({ timeout: 20_000 });

    test.skip(
      await completedState.isVisible().catch(() => false),
      'Desafio do dia já completado hoje pelo user e2e (challenge é idempotente por dia UTC) — data dependency',
    );
    test.skip(
      await errorState.isVisible().catch(() => false),
      'Desafio do dia indisponível (erro de RPC / pool de questões) — data dependency',
    );

    await expect(quiz.getByText(/Questão 1 de \d+/)).toBeVisible({ timeout: 10_000 });

    // --- Go offline ---
    await context.setOffline(true);

    // Q1: as opções são os únicos <button> habilitados dentro do quiz
    // (allowSkip=false; "Continuar" só aparece após responder)
    await quiz.locator('button:not([disabled])').first().click();
    const continuar = quiz.getByRole('button', { name: 'Continuar' });
    await expect(continuar).toBeVisible({ timeout: 5_000 });
    await continuar.click();

    // Q2 — espera a transição (AnimatePresence mode="wait") terminar:
    // o header atualiza imediatamente e o "Continuar" da Q1 sai do DOM
    await expect(quiz.getByText(/Questão 2 de \d+/)).toBeVisible({ timeout: 5_000 });
    await expect(continuar).toBeHidden();
    await quiz.locator('button:not([disabled])').first().click();
    await expect(continuar).toBeVisible({ timeout: 5_000 });

    // --- Back online ---
    await context.setOffline(false);
    await page.waitForTimeout(2_000); // janela para qualquer retry/erro aparecer

    // Assert: nenhum toast de erro (Sonner: data-type="error" cobre
    // variant 'destructive' e 'error' do useToast)
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);

    // Assert: estado do quiz persistiu — continua na Q2, respondida
    // (resultado mostrado + botão Continuar presente)
    await expect(quiz.getByText(/Questão 2 de \d+/)).toBeVisible();
    await expect(continuar).toBeVisible();
  });
});
