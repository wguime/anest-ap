import { CADASTRO_LEGENDA, normNomeNumerica } from '@/lib/escalaNumerica'
import { nomeCirurgiaoCurto, primeiroNome, titleCaseNome } from '@/lib/colunaLiberacao'

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
