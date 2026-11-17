// =============================================================================
// supabase/functions/api-v1/_exemplos.ts — modo de exemplo (`?exemplo=true`)
//
// Dados 100% FICTÍCIOS, no MESMO formato das rotas reais, para o integrador
// validar o parser sem tocar em dado real. Pedido do programador externo
// (nov/2026), aprovado pelo dono. Nenhum nome aqui existe no grupo.
//
// Continua exigindo chave válida + escopo da rota (o gate roda antes); só não
// consulta banco, Firestore nem Pega Plantão. Toda resposta leva
// `"exemplo": true` para nunca ser confundida com dado real.
//
// Ao mudar o formato de uma rota, mude o exemplo dela aqui — o teste
// src/__tests__/functions/apiV1Exemplos.test.js confere que toda rota de
// ROTAS_LEITURA tem exemplo.
// =============================================================================

import type { RotaResultado } from './_contrato.ts'

const A1 = { id: 'exemplo-uid-ana', nome: 'ANA EXEMPLO SOUZA' }
const A2 = { id: 'exemplo-uid-bruno', nome: 'BRUNO FICTICIO LIMA' }
const R1 = { id: 'r2-exemplo', nome: 'Residente Exemplo', ano: 'R2' }
const F1 = { id: 'funcionaria-exemplo', nome: 'Funcionária Exemplo' }

export const EXEMPLOS: Record<string, Record<string, unknown>> = {
  '/v1/escala-cirurgica': {
    data: [
      {
        data: '2026-01-15',
        hospital: 'unimed',
        turno: 'matutino',
        casos: [
          {
            sala: '3', ordem: 1, hora: '07:00', termino_previsto: '09:00', tempo_estimado: '2h',
            cirurgiao: 'Dr. Cirurgião Exemplo', anestesista: A1, residente: { id: R1.id, nome: R1.nome },
            tipo: 'eletiva', status: 'terminada', inicio_real: '07:10', termino_real: '08:55',
            sem_anestesista: false, continuacao: false,
          },
          {
            sala: '5', ordem: 1, hora: '07:30', termino_previsto: null, tempo_estimado: null,
            cirurgiao: 'Dra. Cirurgiã Fictícia', anestesista: null, residente: null,
            tipo: 'urgencia', status: 'agendada', inicio_real: null, termino_real: null,
            sem_anestesista: true, continuacao: false,
          },
        ],
      },
    ],
    meta: { inicio: '2026-01-15', fim: '2026-01-15', hospital: null, turno: null, total_escalas: 1, total_casos: 2 },
  },
  '/v1/escala-cirurgica/plantoes': {
    data: [
      {
        data: '2026-01-15',
        fim_de_semana: false,
        plantoes: [
          { posicao: 'P1', hospital: 'hro', papel: 'plantonista', inicio: '2026-01-15T19:00:00-03:00', fim: '2026-01-16T07:00:00-03:00', anestesista: A1 },
          { posicao: 'P2', hospital: 'unimed', papel: 'plantonista', inicio: '2026-01-15T19:00:00-03:00', fim: '2026-01-16T07:00:00-03:00', anestesista: A2 },
          { posicao: 'P4', hospital: null, papel: 'coringa', inicio: '2026-01-15T19:00:00-03:00', fim: '2026-01-16T07:00:00-03:00', anestesista: { id: null, nome: 'C. Exemplo' } },
        ],
      },
    ],
    meta: { inicio: '2026-01-15', fim: '2026-01-15', fonte: 'pega_plantao', total_dias: 1, total_plantoes: 3 },
  },
  '/v1/anestesistas': {
    data: [
      { id: A1.id, nome: A1.nome, apelidos: ['ANA'], ativo: true },
      { id: A2.id, nome: A2.nome, apelidos: ['BRUNO', 'B. LIMA'], ativo: true },
    ],
    meta: { total: 2, ativos: null },
  },
  '/v1/residentes': { data: [R1] },
  '/v1/residentes/plantoes': {
    inicio: '2026-01-15',
    fim: '2026-01-15',
    data: [
      { data: '2026-01-15', residente: R1, origem: 'troca', inicio: '07:00', fim: '07:00', duracaoHoras: 24, feriado: null },
    ],
  },
  '/v1/residentes/estagios': {
    inicio: '2026-01-15',
    fim: '2026-01-15',
    data: [
      {
        data: '2026-01-15',
        turnos: [
          { turno: 'manha', residentes: [{ ...R1, estagio: 'Neuro', origem: 'base' }] },
          { turno: 'tarde', residentes: [{ ...R1, estagio: 'Pediatria', origem: 'ajuste' }] },
        ],
      },
    ],
  },
  '/v1/funcionarias/escala': {
    inicio: '2026-01-17',
    fim: '2026-01-17',
    data: [
      {
        data: '2026-01-17',
        feriado: null,
        sobreavisoMaterno: { funcionaria: F1, inicio: '19:00', fim: '07:00', origem: 'base' },
        hospitais: [
          { local: 'HRO', turno: 'manha', inicio: '07:00', fim: '15:00', funcionaria: F1, origem: 'base' },
          { local: 'Plantão Pago', turno: 'tarde', inicio: '15:00', fim: '23:00', funcionaria: { id: null, nome: 'Outra Exemplo' }, origem: 'ajuste' },
        ],
      },
    ],
  },
  '/v1/ferias/extrato': {
    ano: 2026,
    fonte: 'pega_plantao+ferias_movimentacoes',
    regras: {
      fim_de_semana: 'não conta',
      feriado: 'só não conta quando a semana inteira está marcada',
      setima_vaga: 'quem marcou por último um dia com mais de 6 sócios paga 3 dias (2 extras)',
    },
    total: 1,
    socios: [
      {
        id: A1.id, nome: 'Ana Exemplo Souza', nome_escala: A1.nome, cota: 30, regra_cota: '4º ano em diante',
        dias_marcados: 15, dias_penalidade: 2, dias_usados: 17, saldo: 13,
        periodos: [{ inicio: '2026-07-13', fim: '2026-07-24', dias_uteis: 10 }, { inicio: '2026-09-07', fim: '2026-09-11', dias_uteis: 5 }],
        penalidades: [{ data: '2026-07-15', dias_extras: 2 }],
      },
    ],
  },
  '/v1/ferias/ausencias': {
    data: [
      { data: '2026-07-15', pessoa: { id: A1.id, nome: 'Ana Exemplo Souza' }, tipo: 'ferias' },
      { data: '2026-07-15', pessoa: { id: A2.id, nome: A2.nome }, tipo: 'ausente' },
      { data: '2026-07-16', pessoa: { id: null, nome: 'NOME SEM CADASTRO' }, tipo: 'ausente' },
    ],
    meta: {
      inicio: '2026-07-15',
      fim: '2026-07-16',
      total: 3,
      fonte: 'pega_plantao+ferias_movimentacoes',
      tipos: {
        ferias: 'férias (Pega Plantão + marcações/desmarcações do app)',
        ausente: 'afastamento no Pega Plantão — o motivo não é informado',
      },
    },
  },
}

/** Resposta de exemplo da rota, ou 404 se a rota não tiver exemplo. */
export function respostaExemplo(rota: string): RotaResultado {
  const body = EXEMPLOS[rota]
  if (!body) return { status: 404, body: { error: 'not_found', detail: 'rota sem exemplo' } }
  return { status: 200, body: { exemplo: true, ...structuredClone(body) } }
}
