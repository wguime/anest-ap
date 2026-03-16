# Formulários Públicos & QR Codes — ANEST

## Formulários (Acesso Anônimo)
- `public/formulario-incidente.html` — Notificação de incidentes
- `public/formulario-denuncia.html` — Canal de denúncias (com anexos via Firebase Storage)

## Sem Autenticação
Firebase SDK compat mode v9.22.0. Create público, leitura requer auth.

## Protocolos
- Incidentes: `INC-YYYYMMDD-XXXX`
- Denúncias: `DEN-YYYYMMDD-XXXX`
- Tracking anônimo: `ANEST-YYYY-XXXXXX`

## Firestore Collections
- `incidentes` — `allow create: if true; allow read/update/delete: if isAuthenticated();`
- `denuncias` — mesmas regras

## Dados Incidente
```javascript
{ protocolo, trackingCode, isAnonimo, notificante: { nome, funcao, setor, ramal, email } | null,
  incidente: { data, hora, local, tipo, severidade, descricao },
  impacto: { dano, acoes, sugestoes }, source: 'externo', status: 'pendente',
  createdAt: serverTimestamp(), gestaoInterna: { responsavel, dataAnalise, parecer, acaoCorretiva, dataResolucao } }
```

## QR Code Component
```jsx
<QRCode value="https://anest-ap.web.app/formulario-incidente.html" size={200} level="M" />
<QRCodeCard value={url} title="..." showDownload showCopy />
<QRCodeMini value={url} size={64} />
```
Dependência: `qrcode` npm package

## Páginas
- `src/pages/incidents/QRCodeGeneratorPage.jsx`
- `src/design-system/components/ui/qr-code.jsx`
