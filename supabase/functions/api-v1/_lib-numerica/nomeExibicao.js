// AUTO-GERADO por scripts/gerar-libs-numerica-api-v1.mjs a partir de src/pages/escala-numerica/nomeExibicao.js
// NÃO EDITAR — edite src/pages/escala-numerica/nomeExibicao.js e rode o script.
// deno-lint-ignore-file
import { CADASTRO_LEGENDA, normNomeNumerica } from './escalaNumerica.js'
import { nomeCirurgiaoCurto, primeiroNome, titleCaseNome } from './colunaLiberacao.js'

/**
 * Nome de EXIBIÇÃO de uma entrada da legenda: primeiro + último do cadastro, como na escala
 * cirúrgica (dono 26/09) — a legenda impressa traz só um nome ("GUSTAVO", "COSTA") e confundia.
 * Dupla ("HUMBERTO / ROBERTA") mostra só o primeiro nome de cada um (dono 27/09): com os
 * sobrenomes a linha cortava a 430px, e os primeiros nomes da dupla não se confundem.
 * Só a tela muda: `p.nome` segue o da legenda porque é ele que casa férias, trocas e o rodapé.
 * Nome fora do cadastro sai só em Título (com acento); nunca se adivinha sobrenome.
 */
export function nomeExibicao(nome) {
  const partes = String(nome || '').split('/').map((p) => p.trim()).filter(Boolean)
  const dupla = partes.length > 1
  return partes
    .map((parte) => {
      const cadastro = CADASTRO_LEGENDA[normNomeNumerica(parte)]?.[0]
      if (!cadastro) return titleCaseNome(parte)
      return dupla ? primeiroNome(cadastro) : nomeCirurgiaoCurto(cadastro)
    })
    .join(' / ')
}
