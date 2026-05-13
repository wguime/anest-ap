# Storage Migration — Firebase → Supabase (Sprint 21, v5.0.0)

## Contexto

Sprint 21 fecha o gap **Fase 10 — Migrate uploads para Supabase Storage** do
planejamento original (`docs/project-phases.md`). Migra 3 caminhos de upload
de Firebase Storage para Supabase Storage. Mantém retro-compatibilidade total
durante transição via flag `storageProvider` + URL pattern detection.

| Path Firebase (legado)            | Bucket Supabase (novo) | Path canônico Supabase                  |
|-----------------------------------|------------------------|-----------------------------------------|
| `avatars/{uid}`                   | `profile-photos`       | `{uid}/avatar.jpg`                      |
| `reunioes/{rid}/{tipo!=ata}/...`  | `reuniao-documentos`   | `{rid}/{tipo}/{ts}_{filename}`          |
| `reunioes/{rid}/ata/...`          | `reuniao-atas`         | `{rid}/{ts}_{filename}`                 |

> **Fora do escopo Sprint 21:** caminhos `educacao/{banners,videos,audios,thumbnails,documents}/...` continuam em
> Firebase Storage. Sprint 22+ pode migrar se produto priorizar.

## Filosofia

- **Escrita SEMPRE em Supabase Storage** a partir da Sprint 21.
- **Leitura prefere Supabase**; URLs legacy Firebase continuam acessíveis as-is.
- **Delete provider-aware**: detecta provider via URL + flags `storageProvider`/`storage_provider`.
- **Sem deleção dos arquivos Firebase** durante a migração — rollback safety. Cleanup só em Sprint 22+ após validação ≥30 dias.

## Arquivos novos

- `src/lib/storage.js` — helpers provider-aware (`detectStorageProvider`, `parseSupabaseStorageUrl`, `uploadToSupabase`, `deleteAnyStorageObject`, `resolveUrl`, `getSignedUrl`, `STORAGE_BUCKETS`).
- `supabase/migrations/20260513150000_storage_migration_buckets.sql` — cria 3 buckets + RLS policies + coluna `documentos.storage_provider`.
- `scripts/migrate-storage-firebase-to-supabase.mjs` — backfill data migration (idempotente, dry-run default).

## Arquivos alterados

- `src/contexts/UserContext.jsx` — `updateAvatar()` agora escreve em `profile-photos` (Supabase). Best-effort cleanup do arquivo Firebase legacy.
- `src/services/reunioesService.js` — `uploadDocumento`, `uploadAta`, `deleteDocumento` agora roteiam pelos novos buckets + delete provider-aware.

## RLS — resumo das policies

### `profile-photos`
- **SELECT**: owner (`firebase_uid() = path[1]`) ou admin.
- **INSERT**: owner-only; bloqueia `..` path traversal.
- **UPDATE**: owner-only.
- **DELETE**: owner ou admin.

### `reuniao-documentos`
- **SELECT**: authenticated (toda equipe lê).
- **INSERT**: authenticated, sub-path deve estar em whitelist `(subsidio|pauta|ata|outros)`.
- **UPDATE/DELETE**: admin-only.

### `reuniao-atas`
- **SELECT**: authenticated.
- **INSERT/UPDATE/DELETE**: admin-only (atas têm aprovação formal).

## Procedimento de aplicação

### 1. Aplicar migration SQL

```bash
# user terminal (com prefixo ! no Claude)
! npx supabase db push --linked --project-ref=vjzrahruvjffyyqyhjny
```

Se `INSERT INTO storage.buckets` falhar por permissões: criar buckets pelo
Dashboard Supabase (Project → Storage → New bucket), depois rodar migration de
novo — RLS policies idempotentes vão criar normalmente.

### 2. Verificar buckets ativos

```bash
npx supabase storage list --linked --project-ref=vjzrahruvjffyyqyhjny
# esperado: documentos, profile-photos, reuniao-documentos, reuniao-atas
```

### 3. Gerar Firebase Admin SDK service account

1. Firebase Console → Project Settings → Service Accounts → Generate new private key.
2. Salvar como `~/.config/firebase-anest-admin.json` (gitignored).

### 4. Backfill data — dry-run

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
  node scripts/migrate-storage-firebase-to-supabase.mjs
```

Output esperado: lista por id do que seria migrado, sem mutação.

### 5. Backfill data — apply

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
  node scripts/migrate-storage-firebase-to-supabase.mjs --apply
```

Cada registro migrado:
1. Baixa Firebase via Admin SDK.
2. Sobe em Supabase bucket equivalente.
3. Atualiza Firestore: `arquivoUrl`/`avatar` aponta para Supabase, `storageProvider='supabase'`, `storage_migrated_at` timestamp.

Log salvo em `/tmp/anest-storage-migration-{ts}.log`.

### 6. Flags úteis do script

| Flag                 | Efeito                                                  |
|----------------------|---------------------------------------------------------|
| (default)            | DRY-RUN (read-only)                                     |
| `--apply`            | executa migração                                        |
| `--only=profiles`    | apenas userProfiles.avatar                              |
| `--only=reunioes`    | apenas reuniao_documentos                              |
| `--limit=N`          | processa no máximo N por collection (debug)            |
| `--verbose`          | log detalhado por registro                              |

## Idempotência

- Migration SQL: `ON CONFLICT` em buckets, `DROP POLICY IF EXISTS` antes do
  CREATE, `IF NOT EXISTS` em coluna/índice. Re-aplicar é seguro.
- Script de backfill: pula registros com `storageProvider='supabase'` ou URL
  Supabase. Rerun após interrupção retoma de onde parou.

## Rollback

1. **Reverter código**: `git revert <commit>` do PR Sprint 21.
2. **Reverter Firestore**: WHERE storage_provider='supabase' → restore original
   Firebase URLs (não há snapshot automático; precisa de backup pré-migration).
3. **Buckets Supabase**: deixar — não atrapalham, custo near-zero sem objetos.
4. **Arquivos Firebase Storage**: NÃO foram deletados, ainda servem como
   fallback durante 30 dias.

> **Recomendado**: antes do `--apply`, exportar snapshot Firestore das duas
> collections (`userProfiles`, `reuniao_documentos`) via `firebase firestore:export`.

## Sprint 22+ cleanup (após validação ≥30 dias)

- Script `scripts/cleanup-firebase-storage.mjs` (a criar) que deleta arquivos
  Firebase de registros já migrados (`storageProvider='supabase'` ∧
  `storage_migrated_at <= now() - INTERVAL '30 days'`).
- Mudar default Firebase Storage retention policy.
- Migrar caminhos `educacao/*` (banners, videos, audios, thumbnails, documents)
  para um bucket `educacao` se produto priorizar.

## Limitações conhecidas

- **Resumable upload**: Supabase JS SDK não oferece resumable upload nativo
  como Firebase. Uploads grandes (~15MB PDFs reuniao) usam single-shot upload.
  Aceitável para o tamanho atual de arquivos do app; revisar se for migrar
  vídeos `educacao` (até 500MB).
- **Signed URL TTL**: 3600s (1h) default. Componentes que cacheiam URLs
  precisam revalidar via `resolveUrl()` (do `src/lib/storage.js`) quando o
  TTL expira.

## Testes

- `src/__tests__/lib/storage.test.js` — 29 tests provider detection, URL
  parsing, upload, delete fallbacks, resolveUrl.
- `src/__tests__/services/reunioesService.docs.test.js` — 17 tests bucket
  routing ata vs non-ata, sanitization, deleteDocumento provider-aware.

Build OK; lint clean nas mudanças; sem regressão nos 82 tests de
reunioesService/UserContext pré-existentes.
