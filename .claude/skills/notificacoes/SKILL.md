---
name: notificacoes
description: Sistema de notificações in-app ANEST (tabela notifications + createSystemNotification + helpers). Use ao adicionar novo fluxo de notificação, corrigir recipientIds, validar LGPD em content/subject, ou debugar notificação que não chega.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Notificações In-App ANEST

## Quando Usar
- Adicionar notificação para um novo evento (ex: "ao publicar X, notificar Y")
- Fix de notificação que não chega ao destinatário esperado
- Garantir LGPD em conteúdo sensível (incidentes, denúncias, cateteres)
- Criar deep-link ao clicar em mensagem da inbox

## NÃO usar para
- E-mail (ver `emailNotificationService.js`)
- Push notifications (ver `EventAlertsContext`)
- Firestore `reunioesNotificacoes` (convocação de reunião — Firestore, não Supabase)

## Arquitetura

```
[Call site da UI/Context]
  └── createSystemNotification(payload)         ← MessagesContext.jsx:664
        ├── recipientIds? batch → notifications[]  (Supabase)
        └── sem recipientIds? broadcast-local   (apenas cu) ⚠️ fallback silencioso
```

**Tabela Supabase:** `public.notifications`

Campos-chave:
- `recipient_id text` — Firebase UID do destinatário (um por linha)
- `category text` — `'sistema' | 'comunicado' | 'incidente' | 'plantao' | 'reuniao' | 'educacao' | 'cateter' | ...`
- `subject text`, `content text`
- `action_url text` + `action_params jsonb` — deep-link ao clicar
- `related_entity_type text` + `related_entity_id text` — **sempre preencher** quando houver entidade (dedup + navegação)
- `read_at`, `dismissable`, `priority` (`urgente|alta|normal|baixa`)

**RLS**: INSERT exige perfil ativo (migration `20260422203000_tighten_notifications_rls.sql`). Edge Functions com `service_role` bypassam.

## Padrão de 3 camadas

### Camada 1 — Helper builder (puro, testável)
Em `src/services/notificationService.js` ou `src/utils/XNotifications.js`:

```javascript
export function buildXNotificationPayload({ arg1, arg2, recipientIds }) {
  return {
    category: 'x',
    subject: '...',
    content: '...',                    // LGPD-safe: sem dados pessoais/clínicos
    senderName: 'Sistema X',
    priority: 'normal',
    actionUrl: 'pageName',
    actionLabel: 'Ver X',
    actionParams: { id: 'xxx' },       // deep-link
    relatedEntityType: 'x',
    relatedEntityId: id,                // dedup (related_entity_id)
    dismissable: true,
    recipientIds: (recipientIds || []).filter(Boolean),
  };
}
```

### Camada 2 — Resolução de recipients
Helper separado; geralmente `getXRecipients(users)`:

```javascript
export function getXRecipients(users) {
  if (!Array.isArray(users)) return [];
  return users
    .filter(u => u?.id && u.active !== false && /* critério */)
    .map(u => u.id);
}
```

Padrões comuns:
- **Todos ativos**: `users.filter(u => u.active !== false).map(u => u.id)`
- **Role específico**: `role === 'anestesiologista' || role === 'medico-residente'`
- **Admin/coord**: `isAdmin === true || isCoordenador === true`
- **Curados**: `incidentResponsibles.filter(r => r.receberX && r.notificarApp).map(r => r.id)` com fallback para admins/coords se vazio

### Camada 3 — Call site
Na página/context que fez a mudança:

```javascript
const { createSystemNotification } = useMessages()
const { users = [] } = useUsersManagement()

const recipientIds = getXRecipients(users)
if (recipientIds.length > 0) {
  const payload = buildXNotificationPayload({ ...args, recipientIds })
  await createSystemNotification(payload)
} else {
  console.warn('[X] Nenhum destinatário — notificação não enviada', context)
}
```

## Armadilhas recorrentes

1. **`recipientIds: undefined` ou `[]`** → cai no fallback broadcast-local do MessagesContext.jsx:708, apenas o autor da ação vê. **Sempre guard** `if (recipientIds.length > 0)`.
2. **`actionParams` ausente** → clique na inbox vai à página genérica mas não abre o item específico. Sempre inclua `{ id }` ou `{ protocolo }` equivalente.
3. **`related_entity_id` ausente** → impede dedup via script ou Edge Function. Scripts como `resend-recent-comunicados.js` dependem dele.
4. **LGPD violation**: `subject` ou `content` contendo nome/descrição/tipo específico de incidente/denúncia/paciente. Exemplos reais que existiam:
   - `subject: Nova denúncia: ${denuncia.titulo}` ← ❌ título pode ser "Assédio por Dr. X"
   - `content: Protocolo X - ${incidente.descricao.substring(0,100)}` ← ❌ descrição pode ter nome paciente
   - Fix: usar apenas `protocolo` + link.
5. **Formulário público** (`public/formulario-incidente.html`) não passa por React → use trigger SQL ou Edge Function para cobrir esse fluxo.
6. **Fire-and-forget** `.catch(err => console.warn(...))` esconde falhas no toast de sucesso. Prefira `await` + try/catch com variant warning/error.

## Helpers disponíveis (já prontos para reutilizar)

Em `src/services/notificationService.js`:
- `notifyComunicadoPublicado({ titulo, tipo, recipientIds, comunicadoId })`
- `notifyAcaoRequerida({ comunicadoTitle, acao, recipientIds, comunicadoId })`
- `notifyNewIncident({ protocolo, tipo, recipientIds })` (wrapper básico)
- `notifyStatusChange({ protocolo, newStatus, recipientId|recipientIds })`
- `notifyNovoConteudoEducacao({ tipo, titulo, entityId, recipientIds })` ← trilha/curso/módulo/aula
- `notifyPlantaoReminder({ setor, horario, dataPlantao, tipoLembrete, recipientId })` (anestesistas)
- `notifyPlantaoResidenteReminder({ setor, horario, dataPlantao, tipoLembrete, recipientId })` (residentes, actionUrl='residencia')
- `notifySobreavisoFuncionariaReminder`, `notifyHospitalFuncionariaReminder`, `notifyFeriasReminder`

Helpers LGPD-safe especializados:
- `src/utils/incidentesResponsaveis.js` → `getResponsaveisIncidentes`, `buildNewIncidentNotificationPayload`, `buildStatusChangeNotificationPayload`
- ⚠️ `src/utils/cateterNotifications.js` foi **DELETADO** (30/07): a escala e o cateter não
  notificam mais por evento. Para LGPD por iniciais, o equivalente vivo é `cateter_iniciais`
  (SQL, no cron) — ver `.claude/rules/cateter-peridural.md`. Não recriar o helper client-side.
- `src/utils/reuniaoNotifications.js` → `buildReuniaoNotificationPayload`
- `src/utils/tradeNotifications.js` → `getTradeNotificationRecipients`, `buildTradeNotificationContent`
- `src/utils/sobreavisoNotifications.js` → idem para funcionárias

## Testes (vitest)

Padrão mínimo:
```javascript
import { describe, it, expect, vi } from 'vitest';
import { buildXNotificationPayload, getXRecipients } from '../../utils/XNotifications';

describe('getXRecipients', () => {
  it('retorna apenas usuários ativos com role esperado', () => { ... });
  it('filtra ids falsy', () => { ... });
});

describe('buildXNotificationPayload', () => {
  it('inclui actionParams + relatedEntityId (deep-link + dedup)', () => { ... });
  it('LGPD: content não expõe nome/descrição', () => { ... });
  it('recipientIds filtrados (null/undefined/"")', () => { ... });
});
```

## Navegação ao clicar (deep-link)

**InboxPage.jsx:249-259** chama `onNavigate(actionUrl, actionParams)`. Garanta que:
1. `actionUrl` é um case válido no `renderAppPage()` do `App.jsx`
2. A página destino **reage a `params`** via `useEffect` (exemplo: `ComunicadosPage.jsx:258`)
3. O effect depende tanto de `params` quanto do array carregado pelo context (senão navegação perde quando context carrega depois)

## Ativação manual / backfill

Script existente: `src/scripts/resend-recent-comunicados.js` é o template para backfill de notificações existentes (lê do DB, dedupa por `related_entity_id`, insere em batch via service_role JWT).

## Edge Function

`supabase/functions/schedule-shift-reminders/index.ts` aceita POST com `{ items: [...] }`, faz dedup e inserção em batch. Use para lembretes agendados via pg_cron. Para chamada manual:

```javascript
await fetch('https://<proj>.supabase.co/functions/v1/schedule-shift-reminders', {
  method: 'POST',
  headers: { Authorization: `Bearer <service_role_jwt>`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [...] }),
});
```

## Inbox / UI

- Inbox: `src/pages/communication/InboxPage.jsx` (3 abas + "Rastrear")
- Detail: `src/pages/communication/MessageDetailPage.jsx`
- Context: `src/contexts/MessagesContext.jsx`
- Service: `src/services/supabaseMessagesService.js`
- DS components (disponíveis mas **não usados** hoje — a InboxPage reimplementou inline): `src/design-system/components/communication/`

## Referências rápidas

| Necessidade | Arquivo |
|---|---|
| Adicionar notificação nova | `notificationService.js` + call site + teste |
| Destinatário por role | criar helper em `src/utils/XNotifications.js` |
| Deep-link inbox→página | `actionUrl` + `actionParams` + useEffect na página destino |
| Dedup/backfill histórico | script padrão `resend-recent-comunicados.js` |
| LGPD content | nunca inclua nome/descrição; use protocolo + link |
| Formulário público (sem React) | trigger SQL ou Edge Function |
