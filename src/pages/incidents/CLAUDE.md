# Incidents — Padrões Locais

> Veja parent rules: `lgpd`, `audit-trail`, `padroes-codigo` (auto-aplicadas).

## Padrões CRUD desta área
- Páginas seguem padrão: `IncidentesPage.jsx` (lista) → `IncidenteDetalhePage.jsx` (detalhe) → `NovoIncidente*` (form)
- Mesmo padrão para denúncias: `DenunciaGestaoPage` → `DenunciaDetalhePage` → form público em `public/formulario-denuncia.html`
- Service: `src/services/supabaseIncidentsService.js`
- Context: `src/contexts/IncidentsContext.jsx` (1233 linhas — reducer + realtime subscription)
- Realtime: usa `createReliableSubscription` (helper canônico)

## Anexos (2026-07-30)
- Upload REAL no submit → bucket privado `incidentes-anexos` (migration `20260730220000`); JSONB `attachments` guarda só metadados `{name, path, size, type}` (lib pura `src/lib/incidenteAnexos.js`; componentes `AnexosUploadSection`/`AnexosListSection`). Antes o form guardava só `file.name` e o INSERT descartava até isso — evidência se perdia em silêncio (DEN-20260727-8445).
- Relato ANÔNIMO → pasta `denuncias-anon/`/`incidentes-anon/`: trigger `tr_incidentes_anexos_scrub_anon` anula `owner_id` no insert (o storage gravaria o UID do uploader). ⚠️ o WHEN do trigger é IMUTÁVEL p/ nós (DROP TRIGGER em storage.objects exige ownership que a Management API não tem) — a lógica vive no corpo de `fn_scrub_anexo_anonimo` (CREATE OR REPLACE sempre disponível; kill switch = RETURN NEW).
- Download por signed URL TTL 300s (`getAnexoSignedUrl`); RLS: `is_admin()` OU dono do upload. Falha de upload BLOQUEIA o envio do relato (toast) — nunca enviar sem a evidência prometida.
- ⚠️ `attachments` PRECISA estar em `INCIDENTE_LIST_COLS`: as páginas de detalhe leem o registro da LISTA do context (`getDenunciaById`), não de `fetchById`.
- Relato anônimo NUNCA persiste o nome original do arquivo (`anexoNomePersistido` → `evidencia-N.ext`; auditoria LGPD 30/07, achado B1 — filename embute identidade) e a UI avisa sobre metadados internos (EXIF/autor). Anonimização Art. 12 (`rpc_anonimizar_incidente`, reescrita na `20260730230000`) também anula owner dos objetos da pasta do protocolo — arquivos ficam (evidência), vínculo de identidade não.
- Sem DELETE no bucket (evidência imutável); eliminação LGPD futura = rota service-role cobrindo 3 casos (auditoria 30/07): órfãos de submit abortado, expiração por `retain_until`, cleanup pós-anonimização se o DPO exigir remoção física. Pendências restantes: Política de Privacidade ainda não cita anexos (texto legal = decisão do dono/DPO) + registrar no RIPD o risco residual de metadados embutidos (EXIF/autor) e de logs de infra.

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
