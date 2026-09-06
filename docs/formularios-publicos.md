# Formulários Públicos & QR Codes — ANEST

Canal de quem está de fora ou não tem conta. O QR code abre o portal, que leva aos dois formulários
e ao acompanhamento por código. Regras de acesso, avisos e runbook do módulo:
`docs/incidentes-denuncias.md`.

## Páginas (HTML puro em `public/`, sem bundler)

| Arquivo | Papel |
|---|---|
| `gestao-incidentes.html` | Portal que o QR abre: dois cartões + acompanhar relato + política de privacidade |
| `formulario-incidente.html` | Notificação de incidente (4 seções) |
| `formulario-denuncia.html` | Canal de denúncias (2 seções) |
| `incidentes-shared.js` | Listas, helpers e **as regras de anexo** compartilhadas pelos dois formulários |

Servidas pelo Firebase Hosting a partir de `dist/` (cópia estática do Vite), com
`Cache-Control: no-cache, no-store` e rewrites próprios que as isolam do fallback da SPA. Como não há
versão em cache, mudança nelas vale no primeiro acesso — foi o que permitiu fechar o envio direto sem
janela de quebra.

## Envio (desde 06/09/2026: pela edge `relato-publico`)

```
1. preparar  → limite por IP · valida a lista declarada · reserva o protocolo
               (rpc_reservar_protocolo) · devolve URL de upload assinada por arquivo
2. navegador → sobe o arquivo direto no armazenamento (o byte não passa pela função)
3. enviar    → limite por IP · grava por rpc_submit_public_incident (chave de serviço)
               · dispara o e-mail de dentro da função
```

Relato sem anexo pula 1 e 2. O protocolo precisa existir **antes** do upload porque o caminho do
anexo o carrega, e é por ele que a limpeza de órfãos separa evidência de lixo.

⚠️ `rpc_submit_public_incident` **não é mais executável pela chave pública** — só pela edge, que é
onde o limite por origem é contado. Antes qualquer um enchia a caixa dos responsáveis com relatos em
massa. Limite: 10 preparar / 5 enviar por IP a cada 10 min, na tabela `documento_api_rate_limit`.

⚠️ O e-mail sai **de dentro da edge**. Era disparo do navegador sem `await` e se perdia quando a
pessoa fechava a aba na tela de sucesso.

## Anexos (canal público)

3 arquivos, 10 MB cada, imagens (JPG/PNG/WebP/HEIC/HEIF) ou PDF. Os tipos são barrados pelo
armazenamento (`allowed_mime_types` do balde `incidentes-anexos`) e valem **também para o app**, que
segue com 5 × 20 MB. HEIC é obrigatório na lista: é o formato padrão da câmera do iPhone, e o
navegador costuma mandar o tipo vazio — por isso `resolveContentType` deriva pela extensão.

Regras em `public/incidentes-shared.js` (`validarAnexosPublico`, `ANEXO_PUBLICO_MAX_*`), espelhadas
em `src/lib/incidenteAnexos.js` para o app e conferidas no servidor pela edge e pela RPC.

O formulário **não envia o relato se um anexo falhar**: relato que promete evidência e chega sem ela
é perda silenciosa.

## Protocolos e rastreio

- Incidentes `INC-YYYYMMDD-NNNN` · Denúncias `DEN-YYYYMMDD-NNNN` — sequência atômica no banco
  (`generate_protocolo`, ou `rpc_reservar_protocolo` quando há anexo). O cliente não escolhe.
- Rastreio `ANEST-YYYY-XXXXXXXX` — gerado pelo trigger, 8 caracteres sem O/I/0/1.
- Acompanhamento anônimo: `rpc_fetch_by_tracking_code` devolve status, histórico e parecer, **nunca
  identidade**.

## Onde os dados ficam

Tabela `incidentes` no Supabase. As coleções Firestore `incidentes`/`denuncias` são **legadas e
travadas** (`allow read, write: if false` desde 05/09/2026) — nada as usa.

## QR Code

```jsx
<QRCode value="https://anest-ap.web.app/gestao-incidentes.html" size={200} level="M" />
<QRCodeCard value={url} title="..." showDownload showCopy />
<QRCodeMini value={url} size={64} />
```
Gerador em `src/pages/incidents/QRCodeGeneratorPage.jsx`; componente em
`src/design-system/components/ui/qr-code.jsx`. O QR aponta para o **portal**, não para um formulário
específico — quem escaneia escolhe entre notificar e denunciar.
