import { useEffect } from 'react';
import { instalarTravaOrientacao } from '@/lib/orientacaoTela';

/**
 * Instala a trava de orientação do app (dono 25/08): a tela NÃO gira, e sem
 * aviso nenhum — no celular deitado o conteúdo é contra-rotacionado e continua
 * em pé. A regra, as duas camadas e a exceção de documento/vídeo estão em
 * `src/lib/orientacaoTela.js`.
 *
 * Não desenha nada. Fica em `main.jsx`, ACIMA do portão de autenticação — a
 * tela de login e o spinner de boot também são o app —, e de fora ficam as
 * rotas públicas `/verificar/*`, que são leitura de documento por quem não é
 * da equipe.
 */
export function TravaOrientacao() {
  useEffect(() => instalarTravaOrientacao(), []);
  return null;
}

export default TravaOrientacao;
