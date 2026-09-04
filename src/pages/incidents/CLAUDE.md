# Incidents — Padrões Locais

> Veja parent rules: `lgpd`, `audit-trail`, `padroes-codigo` (auto-aplicadas).

## Padrões CRUD desta área
- Páginas seguem padrão: `IncidentesPage.jsx` (lista) → `IncidenteDetalhePage.jsx` (detalhe) → `NovoIncidente*` (form)
- Mesmo padrão para denúncias: `DenunciaGestaoPage` → `DenunciaDetalhePage` → form público em `public/formulario-denuncia.html`
- Service: `src/services/supabaseIncidentsService.js`
- Context: `src/contexts/IncidentsContext.jsx` (1233 linhas — reducer + realtime subscription)
- Realtime: usa `createReliableSubscription` (helper canônico)

## Envio pelo app (2026-09-04)

- `createIncidente`/`createDenuncia` chamam a RPC `rpc_submit_incidente` (SECURITY DEFINER, migration `20260904190000`). **Nunca voltar ao `.insert(row).select()`**: o RETURNING passa pelas policies de SELECT e relato ANÔNIMO tem `user_id NULL` → 42501 para todo não-admin (admin nunca vê — "funciona comigo"). Anonimato, `user_id` e `lgpd_consent_at` são decididos no servidor pelo `tipoIdentificacao`; o cliente não manda `user_id`. Trava: `supabaseIncidentsService.submit.test.js`.
- E-mail aos responsáveis (`notify-incident`): deploy com `--no-verify-jwt` e auth dentro da função (`_shared/verify-auth.ts` + anon key HS256 `role=anon` do formulário público). Com `verify_jwt=true` o gateway recusava o ID token Firebase (401 `UNAUTHORIZED_ASYMMETRIC_JWT`) e nenhum e-mail do app saiu entre 10/06 e 04/09. Falha de e-mail vai para `reportError` (o insert antigo em `infra_health_history` usava colunas inexistentes e morria em silêncio).
- Página de gestão sem o registro (id inválido ou fora da RLS) mostra "não encontrado" — o fallback `|| lista[0]` exibia OUTRO relato.

## Anexos (2026-07-30)
- Upload REAL no submit → bucket privado `incidentes-anexos` (migration `20260730220000`); JSONB `attachments` guarda só metadados `{name, path, size, type}` (lib pura `src/lib/incidenteAnexos.js`; componentes `AnexosUploadSection`/`AnexosListSection`). Antes o form guardava só `file.name` e o INSERT descartava até isso — evidência se perdia em silêncio (DEN-20260727-8445).
- Relato ANÔNIMO → pasta `denuncias-anon/`/`incidentes-anon/`: trigger `tr_incidentes_anexos_scrub_anon` anula `owner_id` no insert (o storage gravaria o UID do uploader). ⚠️ o WHEN do trigger é IMUTÁVEL p/ nós (DROP TRIGGER em storage.objects exige ownership que a Management API não tem) — a lógica vive no corpo de `fn_scrub_anexo_anonimo` (CREATE OR REPLACE sempre disponível; kill switch = RETURN NEW).
- Download por signed URL TTL 300s (`getAnexoSignedUrl`); RLS: `is_admin()` OU dono do upload. Falha de upload BLOQUEIA o envio do relato (toast) — nunca enviar sem a evidência prometida.
- ⚠️ `attachments` PRECISA estar em `INCIDENTE_LIST_COLS`: as páginas de detalhe leem o registro da LISTA do context (`getDenunciaById`), não de `fetchById`.
- Relato anônimo NUNCA persiste o nome original do arquivo (`anexoNomePersistido` → `evidencia-N.ext`; auditoria LGPD 30/07, achado B1 — filename embute identidade) e a UI avisa sobre metadados internos (EXIF/autor). Anonimização Art. 12 (`rpc_anonimizar_incidente`, reescrita na `20260730230000`) também anula owner dos objetos da pasta do protocolo — arquivos ficam (evidência), vínculo de identidade não.
- Sem DELETE no bucket (evidência imutável); exclusão física = `scripts/cleanup-incidentes-anexos.mjs` (service-role, dry-run por padrão, `--apply --por <uid>` audita em `permission_audit_log`; cobre órfãos de submit abortado, pastas de relatos anonimizados e `--protocolo` p/ pedido DPO). Política de Privacidade cita anexos (seções 5/9/10) e o RIPD registra R13/M13 (metadados EXIF/autor + logs infra) — fechados 30/07. Runbook de dependências: `docs/incidentes-denuncias.md` (grant UPDATE em storage.objects; trigger imutável). ⚠️ `rpc_aplicar_retencao_incidentes` tinha INSERT de audit com colunas inexistentes que nunca rodou (fix `20260730240000`) — quando mexer em audit de RPC, conferir colunas REAIS de `permission_audit_log` (target_user_id/changed_by/new_value, não user_id/details).

## Anonimização (LGPD obrigatório)
- Campo `isAnonimo` controla coleta de identidade
- Uma vez anonimizado, identidade é **IMUTÁVEL** (nunca permita reverter)
- Tracking público via código `ANEST-YYYY-XXXXXX` (sem identificação pessoal)

## Permissões
- Verificar entry em `PAGE_TO_CARD['incidentes']` em `src/App.jsx`
- Public forms (`public/formulario-incidente.html`, `public/formulario-denuncia.html`):
  - Firestore rule: `allow create: if true; allow read,update,delete: if isAuthenticated();`
- Ownership validation nas páginas de detalhe (impede ver incidente alheio)

## Ao adicionar feature
1. Atualizar `incidentesResponsaveis.js` se introduz novo tipo
2. Audit trail OBRIGATÓRIO em mutations: `changedBy = currentUserId` (NUNCA hardcoded)
3. Considerar invocar `@lgpd-reviewer` antes de commit em mudanças de fluxo de dados
4. Se mudar policy Firestore/Supabase, invocar `@security-reviewer`
