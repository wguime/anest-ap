/**
 * Validação do pedido de troca de plantão da residência — parte pura.
 *
 * "De quem é o plantão" é sempre a escala EFETIVA (tabela + trocas já aceitas em
 * `residenciaPlantaoDiario`): quem recebeu um dia numa troca pode oferecê-lo de
 * novo, e quem o cedeu não pode. Lendo só a tabela, o formulário auto-selecionava
 * o destinatário errado e recusava a segunda troca de um mesmo dia com
 * "Destinatário não está de plantão na data desejada" (caso real: 18/08 → Rodrigo
 * recebeu o 18/08 do Guilherme e ofereceu de novo — a tabela dizia Rodrigo, mas
 * já tinha passado por Guilherme na troca TR974269).
 *
 * @param {Object} p
 * @param {string|null} p.dataPlantaoKey — 'YYYY-MM-DD' oferecida
 * @param {string|null} p.dataDesejadaKey — 'YYYY-MM-DD' desejada (swap) ou null
 * @param {string} p.descricao
 * @param {string|null} p.destinatarioId — residenteId
 * @param {string|null} p.userResidenteId — residenteId de quem pede (null = não validar posse)
 * @param {Object} p.overrides — { 'YYYY-MM-DD': residenteId }
 * @returns {Object} erros por campo (vazio = válido)
 */
import { getResidenteEfetivo } from '../data/plantao2026';

export function validarPedidoTrocaResidencia({
  dataPlantaoKey,
  dataDesejadaKey,
  descricao,
  destinatarioId,
  userResidenteId = null,
  overrides = {},
}) {
  const errors = {};
  const plantonistaOferecida = dataPlantaoKey ? getResidenteEfetivo(dataPlantaoKey, overrides) : null;
  const plantonistaDesejada = dataDesejadaKey ? getResidenteEfetivo(dataDesejadaKey, overrides) : null;

  if (!dataPlantaoKey) {
    errors.dataPlantao = 'Informe a data do plantão';
  } else if (!plantonistaOferecida) {
    errors.dataPlantao = 'Sem plantão cadastrado nesta data';
  } else if (userResidenteId && plantonistaOferecida !== userResidenteId) {
    // Só o plantão EFETIVO pode ser oferecido — um dia já cedido numa troca
    // aceita não é mais seu, mesmo que a tabela impressa ainda diga que é.
    errors.dataPlantao = 'Esta data não é seu plantão (confira as trocas já aceitas)';
  }

  if (!descricao || !descricao.trim()) errors.descricao = 'Informe o motivo da troca';

  if (dataDesejadaKey) {
    if (!destinatarioId) {
      errors.destinatarioId = 'Selecione o residente para trocar';
    } else if (plantonistaDesejada && plantonistaDesejada !== destinatarioId) {
      errors.destinatarioId = 'Destinatário não está de plantão na data desejada';
    }
    if (dataPlantaoKey && dataPlantaoKey === dataDesejadaKey) {
      errors.dataDesejada = 'Datas devem ser diferentes';
    }
  }

  return errors;
}

export default validarPedidoTrocaResidencia;
