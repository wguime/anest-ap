/**
 * incidenteAnexos — regras puras dos anexos de denúncias/incidentes.
 *
 * Bug 2026-07-30: o formulário guardava só o nome do arquivo e o INSERT
 * descartava até isso (DEN-20260727-8445 ficou sem a evidência). A partir
 * daqui o anexo é um objeto { name, path, size, type } — `path` aponta para
 * o bucket privado `incidentes-anexos` e o download é por signed URL.
 *
 * LGPD: o path NUNCA carrega dado pessoal (pasta + protocolo + uuid).
 * Relato anônimo usa pasta *-anon — trigger no banco anula o owner do
 * upload para a identidade não persistir nem no storage.
 */

export const ANEXO_MAX_MB = 20
export const ANEXO_MAX_COUNT = 5

/**
 * Tipos aceitos (decisão do dono 05/09/2026). Vale para os DOIS canais porque
 * `allowed_mime_types` é do balde inteiro (migration 20260906120000): num
 * endereço aberto na internet, executável e compactado não entram.
 * Aqui a lista existe para dar erro legível ANTES do upload — sem ela, o
 * servidor recusaria e, como falha de upload bloqueia o envio, o relato inteiro
 * morreria por causa do anexo.
 */
export const ANEXO_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
]
/** Para o atributo `accept` do seletor de arquivo. */
export const ANEXO_ACCEPT = `${ANEXO_MIMES.join(',')},.heic,.heif`

const MIME_POR_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
}

/**
 * MIME do arquivo, ou '' quando não é um tipo aceito.
 * O navegador manda `type` vazio com frequência — HEIC no Chrome/Firefox é o
 * caso clássico —, e mandar `application/octet-stream` faria o Storage recusar
 * um arquivo perfeitamente válido.
 */
export function resolveContentType(file) {
  if (file?.type && ANEXO_MIMES.includes(file.type)) return file.type
  return MIME_POR_EXT[anexoExtensao(file?.name)] || ''
}

/** Pasta do bucket conforme tipo do relato e anonimato. */
export function pastaAnexo(tipo, anonimo) {
  const base = tipo === 'denuncia' ? 'denuncias' : 'incidentes'
  return anonimo ? `${base}-anon` : base
}

/** Extensão segura (só alfanumérica, máx 10 chars) ou 'bin'. */
export function anexoExtensao(filename) {
  const nome = String(filename || '')
  if (!nome.includes('.')) return 'bin'
  const ext = nome.split('.').pop() || ''
  return /^[a-zA-Z0-9]{1,10}$/.test(ext) ? ext.toLowerCase() : 'bin'
}

/** Path do objeto no bucket — sem dado pessoal (protocolo é gerado pelo app). */
export function buildAnexoPath(pasta, protocolo, uuid, ext) {
  const proto = String(protocolo || 'sem-protocolo').replace(/[^a-zA-Z0-9-]/g, '')
  return `${pasta}/${proto}/${uuid}.${ext}`
}

/**
 * Valida uma seleção de arquivos contra os já escolhidos.
 * @returns {{ ok: boolean, erro?: string }}
 */
export function validarAnexos(novos, existentes = []) {
  const total = existentes.length + novos.length
  if (total > ANEXO_MAX_COUNT) {
    return { ok: false, erro: `Máximo de ${ANEXO_MAX_COUNT} anexos por relato.` }
  }
  const grande = novos.find((f) => f.size > ANEXO_MAX_MB * 1024 * 1024)
  if (grande) {
    return { ok: false, erro: `"${grande.name}" excede ${ANEXO_MAX_MB}MB.` }
  }
  const vazio = novos.find((f) => f.size === 0)
  if (vazio) {
    return { ok: false, erro: `"${vazio.name}" está vazio.` }
  }
  // Tipo (06/09/2026): o balde passou a recusar o que não está em ANEXO_MIMES.
  // Melhor barrar aqui, com nome do arquivo, do que deixar o upload falhar e
  // levar o relato junto.
  const tipoRuim = novos.find((f) => !resolveContentType(f))
  if (tipoRuim) {
    return { ok: false, erro: `"${tipoRuim.name}": envie imagem (JPG, PNG, HEIC) ou PDF.` }
  }
  return { ok: true }
}

/**
 * Nome que vai para o banco: em relato ANÔNIMO o nome original NUNCA é
 * persistido — nomes de arquivo embutem identidade sem o titular perceber
 * ("Digitalização de Fulano.pdf", export de WhatsApp, login do scanner).
 * Vira evidencia-N.<ext> (auditoria LGPD 2026-07-30, achado B1).
 */
export function anexoNomePersistido(originalName, anonimo, index) {
  if (!anonimo) return originalName
  return `evidencia-${index + 1}.${anexoExtensao(originalName)}`
}

/**
 * Normaliza a lista para persistência: só objetos com path e os 4 campos
 * conhecidos (nunca o File). String legada é preservada como { name }.
 */
export function sanitizeAttachments(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((att) => {
      if (typeof att === 'string') return att.trim() ? { name: att.trim() } : null
      if (!att || typeof att !== 'object' || typeof att.path !== 'string') return null
      return {
        name: String(att.name || att.path.split('/').pop()),
        path: att.path,
        size: Number(att.size) || 0,
        type: String(att.type || ''),
      }
    })
    .filter(Boolean)
    .slice(0, ANEXO_MAX_COUNT)
}

/** Nome exibível — tolera o formato legado (string solta). */
export function anexoNome(att) {
  return typeof att === 'string' ? att : att?.name || ''
}

/** Tamanho humano ("1,2 MB") ou '' quando desconhecido. */
export function formatAnexoSize(bytes) {
  const n = Number(bytes)
  if (!n || n <= 0) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
