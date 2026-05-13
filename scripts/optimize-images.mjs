#!/usr/bin/env node
/**
 * Converte PNG/JPG para WebP usando sharp.
 * Lossless para logos com transparência; lossy q=80 para fotos/banners.
 *
 * Uso:
 *   node scripts/optimize-images.mjs
 *
 * Requer: sharp (devDep). Mantém PNG/JPG originais como fallback <picture>.
 */
import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Candidatos priorizados (handoff Sprint 19 + image-optimization-plan.md).
// Logos lossless já gerados em sprint anterior (Anest2.webp, logo-anest.webp).
// Esta passada adiciona banners/anexos de comunicado (quality=75 = ~50% economia).
const TARGETS = [
  { path: 'public/comunicados/25.10 Confra Anest.png', mode: 'lossy', skipIfExists: true },
  { path: 'public/comunicados/25.11 Treinamento Robótica e infecção .JPG', mode: 'lossy', skipIfExists: true },
];

async function main() {
  const sharp = (await import('sharp')).default;
  let totalOriginal = 0;
  let totalWebp = 0;
  let converted = 0;

  for (const { path, mode, skipIfExists } of TARGETS) {
    const abs = join(ROOT, path);
    try {
      const srcStat = await stat(abs);
      const webpPath = abs.replace(/\.(png|jpg|jpeg|JPG)$/i, '.webp');
      if (skipIfExists) {
        try { await stat(webpPath); console.log(`- ${basename(path)} skipped (webp exists)`); continue; }
        catch { /* doesn't exist, proceed */ }
      }
      const options = mode === 'lossless'
        ? { lossless: true, effort: 6 }
        : { quality: 75, effort: 6 };
      await sharp(abs).webp(options).toFile(webpPath);
      const webpStat = await stat(webpPath);
      totalOriginal += srcStat.size;
      totalWebp += webpStat.size;
      converted++;
      const pct = (100 - (webpStat.size / srcStat.size) * 100).toFixed(1);
      console.log(`✓ ${basename(path)} → ${basename(webpPath)} ${(srcStat.size / 1024).toFixed(0)}KB → ${(webpStat.size / 1024).toFixed(0)}KB (-${pct}%) [${mode}]`);
    } catch (err) {
      console.warn(`✗ ${path} skipped: ${err.message}`);
    }
  }

  if (converted) {
    const saved = totalOriginal - totalWebp;
    console.log(`\nTotal: ${converted}/${TARGETS.length} convertidos`);
    console.log(`Antes: ${(totalOriginal / 1024).toFixed(0)} KB | WebP: ${(totalWebp / 1024).toFixed(0)} KB | Economia: ${(saved / 1024).toFixed(0)} KB (-${((saved / totalOriginal) * 100).toFixed(1)}%)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
