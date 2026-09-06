# Incidentes & Denúncias — ANEST

## Páginas (12+)
| Página | Função |
|--------|--------|
| IncidentesPage | Hub principal (5 widgets) |
| NovoIncidentePage | Form 4 steps |
| NovaDenunciaPage | Canal confidencial |
| MeusRelatosPage | Tracking do usuário |
| QRCodeGeneratorPage | Gerador QR |
| AcompanhamentoIncidentePage | Tracking incidente |
| AcompanhamentoDenunciaPage | Tracking denúncia |
| RastrearRelatoPage | Busca por código |
| IncidenteDetalhePage | Detalhe (ownership validation) |
| DenunciaDetalhePage | Detalhe (ownership validation) |
| IncidenteGestaoPage | Gestão interna (Comitê) |
| DenunciaGestaoPage | Gestão interna (Comitê) |

## 5 Widgets IncidentesPage
1. Relatar Notificação — Form novo incidente
2. Fazer Denúncia — Canal confidencial seguro
3. Meus Relatos — Tracking pessoal
4. Gerar QR Code — Acesso rápido formulários
5. Notificação Unimed — Link externo: `https://patientsafety.epimedmonitor.com`

## LGPD no Workflow
- Checkbox consentimento por relato
- Coleta condicional userId
- Coleta condicional gênero (denúncias)
- Acesso ao relato: autor OU responsável marcado (ver "Quem vê" abaixo)
- PrivacyPolicyModal (11 seções)

## Quem vê e quem é avisado (decisão do dono 05/09/2026)

**Relato é EXCLUSIVO de quem está marcado como responsável** em `incident_notification_settings`
(Centro de Gestão → Incidentes → Responsáveis), por tipo. Admin que não está marcado **não vê, não
gere e não baixa anexo** — nem no app nem pela API. Antes a RLS liberava `admin_users` (lista fixa de
fev/2026) enquanto a tela deixava marcar qualquer pessoa: quem era marcado sem ser admin recebia o
aviso, abria e via a lista vazia.

| Onde | Regra |
|---|---|
| `incidentes` (SELECT/UPDATE) | `inc_select_own` (autor) · `inc_select_responsavel` / `inc_update_responsavel` via `is_incident_responsible(tipo)` |
| Balde `incidentes-anexos` (SELECT) | dono do upload OU responsável do tipo |
| `incident_notification_settings` | leitura: admin, própria linha ou responsável. **Escrita: só admin** |
| Aviso in-app + push | SÓ responsáveis do tipo com "avisar no app", **sem fallback** para admin |
| E-mail | caixas fixas `anestdenuncia@` / `anestnotificacao@`. O `notificar_email` das configurações **não tem efeito** |

⚠️ Escrever em `incident_notification_settings` virou privilégio: a tabela passou a ser fonte de
autorização, e sem isso qualquer pessoa se marcava responsável e lia todas as denúncias.
Trigger `incidentes_protect_identity` impede responsável não-admin de reescrever identidade,
anexos e imutáveis do relato. `rpc_anonimizar_incidente` exige admin; a retenção só roda pelo cron.

## Como o relato é gravado

| Canal | Caminho |
|---|---|
| App (autenticado) | `rpc_submit_incidente` (SECURITY DEFINER) — decide anonimato, `user_id`, consentimento e status no servidor |
| Público (QR code) | edge `relato-publico` → `rpc_submit_public_incident` com chave de serviço |

⚠️ **Nunca voltar ao `.insert().select()`** no caminho autenticado: o RETURNING passa pelas policies
de SELECT e relato anônimo tem `user_id` nulo, então dava 42501 para todo não-admin (admin nunca via
— "funciona comigo"). Auditoria de 04/09/2026. Trava: `supabaseIncidentsService.submit.test.js`.
Não há INSERT direto na tabela: as policies de INSERT (`inc_insert_auth`, `inc_insert_anon`) foram
removidas, só as duas RPCs gravam.

## Supabase Service
- `src/services/supabaseIncidentsService.js`
- CRUD + real-time + anonymous tracking
- Escrita pela RPC; leitura sob RLS por responsável

## Formulários Públicos (canal do QR code)

`public/gestao-incidentes.html` (portal que o QR abre) → `formulario-incidente.html` /
`formulario-denuncia.html`, mais o acompanhamento por código. HTML puro, sem bundler; regras
compartilhadas em `public/incidentes-shared.js`. Detalhe de campos em `docs/formularios-publicos.md`.

**Envio (desde 06/09/2026) passa pela edge `relato-publico`**, nunca mais direto pela chave pública:

1. `preparar` — limite por IP, valida a lista declarada, reserva o protocolo
   (`rpc_reservar_protocolo`) e devolve uma URL de upload assinada por arquivo.
2. O navegador sobe o arquivo direto no armazenamento (o byte não passa pela função).
3. `enviar` — limite por IP, grava por `rpc_submit_public_incident` e dispara o e-mail.

Relato sem anexo pula 1 e 2. O protocolo precisa existir **antes** do upload porque o caminho do
anexo o carrega, e é por ele que a limpeza de órfãos separa evidência de lixo.

- **Limites do canal público:** 3 arquivos, 10 MB cada, imagens (JPG/PNG/WebP/HEIC) ou PDF.
  O app segue com 5 × 20 MB, mas **os tipos valem para os dois** — `allowed_mime_types` é do balde.
- **Limite por origem:** 10 preparar / 5 enviar por IP a cada 10 min, na tabela
  `documento_api_rate_limit` e no cron de limpeza que já existiam.
- Coleções Firestore `incidentes`/`denuncias` são legadas e estão **travadas** (`allow read, write:
  if false`); nada no canal público as usa.

## Integração
- Centro de Gestão → aba Incidentes
- LGPD rule → auto-enforced
- QR Codes → formulários públicos
- Dashboard → métricas consolidadas

## Anexos (2026-07-30)
Evidências sobem de verdade para o bucket privado `incidentes-anexos` (antes o form guardava só `file.name` e o INSERT descartava — DEN-20260727-8445 perdeu o anexo). Metadados `{name, path, size, type}` no JSONB `attachments`; download por signed URL TTL 300s (admin ou dono do upload); relato anônimo nunca persiste o nome original (`evidencia-N.ext`) e o trigger anula `owner_id` nas pastas `*-anon`. Detalhes/lições em `src/pages/incidents/CLAUDE.md`; riscos e mitigação em `docs/lgpd-ripd-incidentes.md` (R13/M13); retenção em `docs/lgpd-retencao.md`.

### Anexos no canal público (2026-09-06)
Caminho `pasta/PROTOCOLO/uuid.ext` igual ao do app, com a pasta `*-anon` decidida pelo servidor. A RPC
confere formato do protocolo, pasta conforme o anonimato, ausência de `..` e **existência real do
objeto** — sem isso dava para forjar um relato apontando para a evidência de outro, e `attachments` é
imutável para não-admin. Nome do arquivo em relato anônimo vira `evidencia-N.ext` na própria edge, não
no cliente.

⚠️ `allowed_mime_types` no balde confere o **tipo declarado na requisição**; o armazenamento não
inspeciona o conteúdo. É guarda de usabilidade e rede de segurança, não controle — o que protege é o
balde ser privado, sem execução, com download só por link temporário. Não há antivírus.

⚠️ Mexer nos tipos aceitos exige mexer no app junto: falha de upload **bloqueia o envio do relato**
por desenho (30/07/2026), então um tipo recusado pelo balde e aceito pelo seletor derruba o relato
inteiro. Manter em par: `ANEXO_MIMES`/`ANEXO_ACCEPT` em `src/lib/incidenteAnexos.js`, a lista da
migration e a de `public/incidentes-shared.js`.

⚠️ Chamada entre edges usa a chave de serviço comparada por **igualdade**, nunca por assinatura: as
chaves novas do Supabase não são JWT e a verificação devolvia 401 — foi assim que o e-mail do canal
público sumiu em silêncio no teste de 06/09.

### Runbook — dependências a re-testar
- **Grant de UPDATE em `storage.objects` (role postgres):** `rpc_anonimizar_incidente` (scrub de anexos) depende dele. A Supabase vem restringindo acesso direto ao schema storage — após QUALQUER aviso de mudança de permissões da plataforma, re-testar com o probe de insert+rollback (ver commit ce034ce). Falha aqui = anonimização inteira falha alto e atômico (comportamento desejado; nunca capturar a exceção).
- **Trigger `tr_incidentes_anexos_scrub_anon` é imutável para nós** (DROP exige ownership de `storage.objects`). Mudança de comportamento = editar `fn_scrub_anexo_anonimo` via CREATE OR REPLACE; kill switch = corpo `RETURN NEW`.
- **Limpeza física do bucket:** `node scripts/cleanup-incidentes-anexos.mjs` (dry-run por padrão; `--apply --por <uid>` executa e audita; `--protocolo X` p/ pedido do DPO). Rodar trimestralmente ou sob demanda — cobre órfãos de submit abortado, pastas de relatos anonimizados e eliminação Art. 18.
