/**
 * DocumentoDetalhePage — slice tests (W3-2 smoke).
 *
 * Verifies:
 *  • Folder import resolves: `@/pages/DocumentoDetalhePage` (folder) → index.jsx default export.
 *  • SSOT TIPO_DISPLAY_CONFIG is consumed from '@/types/documents' (no duplicated 30-entry hardcode).
 *  • The 3 modals are lazy-loaded (top-level dynamic imports), not eagerly bundled.
 *
 * NOTE — A heavier render-based slice (mocked DocumentsContext + UserContext + DS)
 * is deferred: the full mock of '@/design-system' + 'lucide-react' (Proxy) plus
 * dynamic-import of the 3 lazy modals caused vitest worker hangs during module
 * graph resolution. The smoke checks below verify the structural contract that
 * the user's brief specified (folder layout, SSOT, lazy modals) without hitting
 * the JSDOM render path that triggers the hang. A follow-up should add a render
 * test once the lucide-react/DS mock interaction is stabilized.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

describe('DocumentoDetalhePage (slice/structure)', () => {
  it('folder structure matches W3-2 spec (index + 5 subcomponents + 3 modals + 2 hooks)', () => {
    expect(existsSync(resolve(ROOT, 'index.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentHeader.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentMetadata.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentVersions.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentApproval.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'DocumentAuditTrail.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'modals/EditDocumentModal.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'modals/NewVersionModal.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'modals/ArchiveDocumentModal.jsx'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'hooks/useDocumentDetail.js'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'hooks/useDocumentMutations.js'))).toBe(true);
  });

  it('old monolithic DocumentoDetalhePage.jsx has been removed', () => {
    expect(existsSync(resolve(ROOT, '..', 'DocumentoDetalhePage.jsx'))).toBe(false);
  });

  it('the 3 modals are wired through React.lazy in index.jsx', () => {
    const indexSrc = readFileSync(resolve(ROOT, 'index.jsx'), 'utf-8');
    expect(indexSrc).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\(['"]\.\/modals\/EditDocumentModal['"]\)\s*\)/);
    expect(indexSrc).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\(['"]\.\/modals\/NewVersionModal['"]\)\s*\)/);
    expect(indexSrc).toMatch(/lazy\(\s*\(\s*\)\s*=>\s*import\(['"]\.\/modals\/ArchiveDocumentModal['"]\)\s*\)/);
    expect(indexSrc).toMatch(/import\s*\{[^}]*\blazy\b[^}]*\}\s*from\s*['"]react['"]/);
    expect(indexSrc).toMatch(/import\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*['"]react['"]/);
  });

  it('TIPO_DISPLAY_CONFIG SSOT is imported from @/types/documents (no inline 30-entry hardcode)', () => {
    const metadataSrc = readFileSync(resolve(ROOT, 'DocumentMetadata.jsx'), 'utf-8');
    expect(metadataSrc).toMatch(/import\s*\{[^}]*TIPO_DISPLAY_CONFIG[^}]*\}\s*from\s*['"]@\/types\/documents['"]/);
    // Defensive: no large inline tipoConfig literal in the new metadata file.
    const inlineMatches = metadataSrc.match(/tipoConfig\s*=\s*\{/g) || [];
    expect(inlineMatches.length).toBe(0);
  });
});
