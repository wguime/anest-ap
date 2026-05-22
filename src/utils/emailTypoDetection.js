/**
 * Email typo detection — flagged 2026-05-21 após incidente Erlei
 * (admin digitou "clinicacastelo" em vez de "clinicastelo", criou orphan).
 *
 * Estratégia (proporcional ao tamanho do dataset — não vale Damerau-Levenshtein full):
 *   1. Validar regex strict de email.
 *   2. Para cada email já autorizado, extrair domain. Construir Set de domains.
 *   3. Comparar domain do email novo contra todos os domains existentes.
 *      Se Levenshtein distance ≤ 2 mas != 0 → suspeita de typo.
 *   4. Comparar local-part (antes do @) também: se parte local + domain está
 *      muito próximo de um email existente inteiro → suspeita de typo.
 *
 * Retorno: { valid: bool, error?: string, suggestion?: string }
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

/**
 * Distância de Levenshtein. O(m*n) tempo e espaço.
 * Apenas para strings curtas (≤32 chars típico de domain).
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Valida formato e procura typo provável contra lista de emails existentes.
 * @param {string} email - Email novo a validar
 * @param {Array<{email: string}>} existingEmails - Lista de emails já autorizados
 * @returns {{valid: boolean, error?: string, suggestion?: string, suggestionType?: 'domain'|'full'}}
 */
export function detectEmailTypo(email, existingEmails = []) {
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized) return { valid: false, error: 'Email obrigatório' };
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: 'Formato de email inválido' };
  }

  const [localPart, domain] = normalized.split('@');
  if (!localPart || !domain) {
    return { valid: false, error: 'Email malformado' };
  }

  // Lista de domínios únicos já autorizados
  const existingDomains = new Set();
  const fullEmails = new Set();
  for (const entry of existingEmails) {
    const e = String(entry?.email || '').trim().toLowerCase();
    if (!e || !e.includes('@')) continue;
    fullEmails.add(e);
    const [, d] = e.split('@');
    if (d) existingDomains.add(d);
  }

  // Email duplicado exato (case-insensitive)
  if (fullEmails.has(normalized)) {
    return { valid: false, error: 'Email já está autorizado' };
  }

  // Typo no email INTEIRO (caso usuário escreve mal o local-part E domain similar)
  let closestFullEmail = null;
  let closestFullDist = Infinity;
  for (const e of fullEmails) {
    // Só considera emails cujo tamanho não diverge demais (skip otimização)
    if (Math.abs(e.length - normalized.length) > 3) continue;
    const dist = levenshtein(e, normalized);
    if (dist < closestFullDist) {
      closestFullDist = dist;
      closestFullEmail = e;
    }
  }
  // Se 1-2 chars de diferença num email completo, é típico typo
  if (closestFullDist > 0 && closestFullDist <= 2 && closestFullEmail) {
    return {
      valid: true,
      suggestion: closestFullEmail,
      suggestionType: 'full',
    };
  }

  // Typo no DOMAIN (novo user, mesmo "tenant" da clínica)
  let closestDomain = null;
  let closestDomainDist = Infinity;
  for (const d of existingDomains) {
    if (Math.abs(d.length - domain.length) > 3) continue;
    const dist = levenshtein(d, domain);
    if (dist < closestDomainDist) {
      closestDomainDist = dist;
      closestDomain = d;
    }
  }
  if (closestDomainDist > 0 && closestDomainDist <= 2 && closestDomain) {
    return {
      valid: true,
      suggestion: `${localPart}@${closestDomain}`,
      suggestionType: 'domain',
    };
  }

  return { valid: true };
}
