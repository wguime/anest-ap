# Comunicados & Inbox — ANEST

## Páginas
- `InboxPage.jsx` — Mail-style inbox (4 tabs: Todas, Mensagens, Notificações, Rastrear)
- `MessageDetailPage.jsx` — Detalhe com reply/archive/delete

## Data Structure
```javascript
{
  id, tipo: 'Urgente'|'Importante'|'Informativo'|'Evento'|'Geral',
  titulo, conteudo, link, dataEvento,
  anexos: [{ nome, url, tamanho, tipo }],
  autorId, autorNome, createdAt, lido, arquivado,
  // Qmentum
  destinatarios: ['anestesiologista', 'medico-residente', ...], // [] = todos
  leituraObrigatoria: boolean,
  confirmacoes: [{ userId, userName, confirmedAt }],
  ropArea: 'cultura-seguranca', // ROP_AREAS key
  acoesRequeridas: [{ id, texto }],
  acoesCompletadas: [{ acaoId, userId, userName, completedAt }],
  status: 'rascunho'|'aprovado'|'publicado',
  aprovadoPor: { userId, userName, approvedAt },
  prazoConfirmacao, dataValidade
}
```

## Categorias de Notificação (10)
plantao (#006837), comunicado (#2563EB), educacao (#7C3AED), incidente (#DC2626),
qualidade (#059669), documento (#D97706), sistema (#6366F1), reuniao (#0891B2),
faturamento (#BE185D), rops (#EA580C)

## Constants
- `ROLES_DESTINATARIOS` — 8 roles
- `ROP_AREAS` — 7 áreas com cores
- `STATUS_COMUNICADO` — 3 status com cores
- `tiposComunicado` — Array value/label/color

## Helper Functions
calcularTotalDestinatarios, isPrazoVencido, isExpirado,
formatRelativeDate, formatFullDate, formatCardDate, formatEventDate,
getTipoColor, getFileIcon

## Integração
- Centro de Gestão → aba Comunicados (3 tabs)
- Educação → notificações de conteúdo
- Real-time via Supabase subscription
