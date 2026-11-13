// AUTO-GERADO por scripts/gerar-dados-api-v1.mjs — NÃO EDITAR À MÃO.
// Fonte: src/data/{residencia2026,plantao2026,sobreavisoMaterno2026,hospitaisTecnicas2026}.js
// Sem e-mail nem cargo (LGPD): só id, nome, ano e as tabelas de escala.

export interface Pessoa { id: string; nome: string }
export interface Residente extends Pessoa { ano: string }
export interface Quinzena { inicio: string; fim: string; estagios: Record<string, string | null> }
export interface HospitaisDia { hro: string | null; unimed: string | null; plantaoPago: string | null }

export const RESIDENTES: Residente[] = [
  {
    "id": "r1-augusto",
    "nome": "Augusto",
    "ano": "R1"
  },
  {
    "id": "r1-guilherme",
    "nome": "Guilherme",
    "ano": "R1"
  },
  {
    "id": "r1-roosewelt",
    "nome": "Roosewelt",
    "ano": "R1"
  },
  {
    "id": "r2-daniel",
    "nome": "Daniel",
    "ano": "R2"
  },
  {
    "id": "r2-jacinta",
    "nome": "Jacinta",
    "ano": "R2"
  },
  {
    "id": "r2-rodrigo",
    "nome": "Rodrigo",
    "ano": "R2"
  },
  {
    "id": "r3-raffaela",
    "nome": "Raffaela",
    "ano": "R3"
  },
  {
    "id": "r3-wagner",
    "nome": "Wagner",
    "ano": "R3"
  }
]

export const PLANTOES_RESIDENCIA: Record<string, string> = {
  "2026-03-01": "r2-daniel",
  "2026-03-02": "r3-raffaela",
  "2026-03-03": "r2-rodrigo",
  "2026-03-04": "r3-wagner",
  "2026-03-05": "r2-daniel",
  "2026-03-06": "r2-jacinta",
  "2026-03-07": "r3-raffaela",
  "2026-03-08": "r2-rodrigo",
  "2026-03-09": "r3-wagner",
  "2026-03-10": "r2-jacinta",
  "2026-03-11": "r2-daniel",
  "2026-03-12": "r3-raffaela",
  "2026-03-13": "r2-rodrigo",
  "2026-03-14": "r3-wagner",
  "2026-03-15": "r2-jacinta",
  "2026-03-16": "r2-daniel",
  "2026-03-17": "r3-raffaela",
  "2026-03-18": "r2-rodrigo",
  "2026-03-19": "r3-wagner",
  "2026-03-20": "r2-daniel",
  "2026-03-21": "r2-jacinta",
  "2026-03-22": "r3-raffaela",
  "2026-03-23": "r2-rodrigo",
  "2026-03-24": "r3-wagner",
  "2026-03-25": "r2-jacinta",
  "2026-03-26": "r2-rodrigo",
  "2026-03-27": "r3-raffaela",
  "2026-03-28": "r2-daniel",
  "2026-03-29": "r3-wagner",
  "2026-03-30": "r2-jacinta",
  "2026-03-31": "r2-rodrigo",
  "2026-04-01": "r3-wagner",
  "2026-04-02": "r2-jacinta",
  "2026-04-03": "r2-daniel",
  "2026-04-04": "r2-rodrigo",
  "2026-04-05": "r3-raffaela",
  "2026-04-06": "r1-augusto",
  "2026-04-07": "r2-jacinta",
  "2026-04-08": "r1-roosewelt",
  "2026-04-09": "r3-wagner",
  "2026-04-10": "r2-rodrigo",
  "2026-04-11": "r2-jacinta",
  "2026-04-12": "r2-rodrigo",
  "2026-04-13": "r1-guilherme",
  "2026-04-14": "r2-rodrigo",
  "2026-04-15": "r3-wagner",
  "2026-04-16": "r1-guilherme",
  "2026-04-17": "r2-daniel",
  "2026-04-18": "r1-augusto",
  "2026-04-19": "r2-jacinta",
  "2026-04-20": "r1-augusto",
  "2026-04-21": "r3-raffaela",
  "2026-04-22": "r1-roosewelt",
  "2026-04-23": "r3-raffaela",
  "2026-04-24": "r1-augusto",
  "2026-04-25": "r2-daniel",
  "2026-04-26": "r1-guilherme",
  "2026-04-27": "r3-wagner",
  "2026-04-28": "r1-guilherme",
  "2026-04-29": "r3-raffaela",
  "2026-04-30": "r2-daniel",
  "2026-05-01": "r1-roosewelt",
  "2026-05-02": "r2-rodrigo",
  "2026-05-03": "r1-guilherme",
  "2026-05-04": "r2-rodrigo",
  "2026-05-05": "r1-roosewelt",
  "2026-05-06": "r2-rodrigo",
  "2026-05-07": "r2-jacinta",
  "2026-05-08": "r2-daniel",
  "2026-05-09": "r1-guilherme",
  "2026-05-10": "r2-rodrigo",
  "2026-05-11": "r1-guilherme",
  "2026-05-12": "r2-jacinta",
  "2026-05-13": "r1-augusto",
  "2026-05-14": "r2-rodrigo",
  "2026-05-15": "r3-wagner",
  "2026-05-16": "r2-daniel",
  "2026-05-17": "r1-augusto",
  "2026-05-18": "r1-roosewelt",
  "2026-05-19": "r1-augusto",
  "2026-05-20": "r2-jacinta",
  "2026-05-21": "r3-wagner",
  "2026-05-22": "r1-augusto",
  "2026-05-23": "r2-jacinta",
  "2026-05-24": "r1-roosewelt",
  "2026-05-25": "r1-augusto",
  "2026-05-26": "r3-wagner",
  "2026-05-27": "r1-roosewelt",
  "2026-05-28": "r2-jacinta",
  "2026-05-29": "r1-guilherme",
  "2026-05-30": "r2-daniel",
  "2026-05-31": "r1-guilherme",
  "2026-06-01": "r3-raffaela",
  "2026-06-02": "r2-daniel",
  "2026-06-03": "r1-roosewelt",
  "2026-06-04": "r3-wagner",
  "2026-06-05": "r2-rodrigo",
  "2026-06-06": "r1-roosewelt",
  "2026-06-07": "r2-daniel",
  "2026-06-08": "r1-augusto",
  "2026-06-09": "r1-guilherme",
  "2026-06-10": "r3-raffaela",
  "2026-06-11": "r1-guilherme",
  "2026-06-12": "r1-roosewelt",
  "2026-06-13": "r1-augusto",
  "2026-06-14": "r3-raffaela",
  "2026-06-15": "r3-wagner",
  "2026-06-16": "r2-daniel",
  "2026-06-17": "r2-jacinta",
  "2026-06-18": "r3-raffaela",
  "2026-06-19": "r1-augusto",
  "2026-06-20": "r2-rodrigo",
  "2026-06-21": "r1-augusto",
  "2026-06-22": "r2-daniel",
  "2026-06-23": "r3-raffaela",
  "2026-06-24": "r1-guilherme",
  "2026-06-25": "r2-daniel",
  "2026-06-26": "r2-rodrigo",
  "2026-06-27": "r3-wagner",
  "2026-06-28": "r2-jacinta",
  "2026-06-29": "r1-guilherme",
  "2026-06-30": "r2-jacinta",
  "2026-07-01": "r2-daniel",
  "2026-07-02": "r2-rodrigo",
  "2026-07-03": "r2-jacinta",
  "2026-07-04": "r1-guilherme",
  "2026-07-05": "r2-daniel",
  "2026-07-06": "r3-raffaela",
  "2026-07-07": "r3-wagner",
  "2026-07-08": "r2-daniel",
  "2026-07-09": "r3-raffaela",
  "2026-07-10": "r1-guilherme",
  "2026-07-11": "r1-roosewelt",
  "2026-07-12": "r2-rodrigo",
  "2026-07-13": "r1-roosewelt",
  "2026-07-14": "r2-daniel",
  "2026-07-15": "r1-guilherme",
  "2026-07-16": "r3-wagner",
  "2026-07-17": "r2-rodrigo",
  "2026-07-18": "r1-guilherme",
  "2026-07-19": "r1-augusto",
  "2026-07-20": "r1-roosewelt",
  "2026-07-21": "r1-augusto",
  "2026-07-22": "r3-raffaela",
  "2026-07-23": "r3-wagner",
  "2026-07-24": "r1-augusto",
  "2026-07-25": "r2-rodrigo",
  "2026-07-26": "r1-roosewelt",
  "2026-07-27": "r3-wagner",
  "2026-07-28": "r1-guilherme",
  "2026-07-29": "r1-augusto",
  "2026-07-30": "r3-raffaela",
  "2026-07-31": "r2-jacinta",
  "2026-08-01": "r1-augusto",
  "2026-08-02": "r2-jacinta",
  "2026-08-03": "r2-rodrigo",
  "2026-08-04": "r3-raffaela",
  "2026-08-05": "r2-jacinta",
  "2026-08-06": "r3-wagner",
  "2026-08-07": "r1-roosewelt",
  "2026-08-08": "r3-raffaela",
  "2026-08-09": "r2-daniel",
  "2026-08-10": "r2-jacinta",
  "2026-08-11": "r2-daniel",
  "2026-08-12": "r2-rodrigo",
  "2026-08-13": "r3-raffaela",
  "2026-08-14": "r1-augusto",
  "2026-08-15": "r1-roosewelt",
  "2026-08-16": "r3-wagner",
  "2026-08-17": "r2-daniel",
  "2026-08-18": "r2-rodrigo",
  "2026-08-19": "r1-guilherme",
  "2026-08-20": "r2-daniel",
  "2026-08-21": "r2-jacinta",
  "2026-08-22": "r1-augusto",
  "2026-08-23": "r1-guilherme",
  "2026-08-24": "r1-roosewelt",
  "2026-08-25": "r1-guilherme",
  "2026-08-26": "r3-wagner",
  "2026-08-27": "r1-roosewelt",
  "2026-08-28": "r1-augusto",
  "2026-08-29": "r2-jacinta",
  "2026-08-30": "r3-wagner",
  "2026-08-31": "r2-daniel",
  "2026-09-01": "r2-jacinta",
  "2026-09-02": "r1-guilherme",
  "2026-09-03": "r2-jacinta",
  "2026-09-04": "r1-roosewelt",
  "2026-09-05": "r2-daniel",
  "2026-09-06": "r1-augusto",
  "2026-09-07": "r2-rodrigo",
  "2026-09-08": "r1-augusto",
  "2026-09-09": "r2-jacinta",
  "2026-09-10": "r1-augusto",
  "2026-09-11": "r1-guilherme",
  "2026-09-12": "r1-roosewelt",
  "2026-09-13": "r2-jacinta",
  "2026-09-14": "r1-augusto",
  "2026-09-15": "r1-guilherme",
  "2026-09-16": "r2-rodrigo",
  "2026-09-17": "r3-raffaela",
  "2026-09-18": "r1-augusto",
  "2026-09-19": "r2-rodrigo",
  "2026-09-20": "r1-guilherme",
  "2026-09-21": "r3-wagner",
  "2026-09-22": "r2-daniel",
  "2026-09-23": "r3-raffaela",
  "2026-09-24": "r2-daniel",
  "2026-09-25": "r1-roosewelt",
  "2026-09-26": "r1-augusto",
  "2026-09-27": "r2-rodrigo",
  "2026-09-28": "r1-guilherme",
  "2026-09-29": "r3-wagner",
  "2026-09-30": "r3-raffaela",
  "2026-10-01": "r3-wagner",
  "2026-10-02": "r1-guilherme",
  "2026-10-03": "r1-roosewelt",
  "2026-10-04": "r1-roosewelt",
  "2026-10-05": "r3-raffaela",
  "2026-10-06": "r3-wagner",
  "2026-10-07": "r2-jacinta",
  "2026-10-08": "r1-roosewelt",
  "2026-10-09": "r1-augusto",
  "2026-10-10": "r1-guilherme",
  "2026-10-11": "r3-wagner",
  "2026-10-12": "r1-augusto",
  "2026-10-13": "r2-jacinta",
  "2026-10-14": "r3-wagner",
  "2026-10-15": "r2-jacinta",
  "2026-10-16": "r3-raffaela",
  "2026-10-17": "r1-roosewelt",
  "2026-10-18": "r2-rodrigo",
  "2026-10-19": "r2-daniel",
  "2026-10-20": "r3-raffaela",
  "2026-10-21": "r2-rodrigo",
  "2026-10-22": "r2-daniel",
  "2026-10-23": "r1-roosewelt",
  "2026-10-24": "r1-guilherme",
  "2026-10-25": "r1-augusto",
  "2026-10-26": "r2-jacinta",
  "2026-10-27": "r2-rodrigo",
  "2026-10-28": "r2-daniel",
  "2026-10-29": "r3-raffaela",
  "2026-10-30": "r2-daniel",
  "2026-10-31": "r1-augusto",
  "2026-11-01": "r1-guilherme",
  "2026-11-02": "r2-daniel",
  "2026-11-03": "r2-rodrigo",
  "2026-11-04": "r3-wagner",
  "2026-11-05": "r1-augusto",
  "2026-11-06": "r3-wagner",
  "2026-11-07": "r2-jacinta",
  "2026-11-08": "r2-rodrigo",
  "2026-11-09": "r3-raffaela",
  "2026-11-10": "r2-daniel",
  "2026-11-11": "r2-rodrigo",
  "2026-11-12": "r3-wagner",
  "2026-11-13": "r3-raffaela",
  "2026-11-14": "r1-augusto",
  "2026-11-15": "r2-daniel",
  "2026-11-16": "r2-jacinta",
  "2026-11-17": "r1-augusto",
  "2026-11-18": "r3-raffaela",
  "2026-11-19": "r1-guilherme",
  "2026-11-20": "r2-jacinta",
  "2026-11-21": "r1-roosewelt",
  "2026-11-22": "r2-jacinta",
  "2026-11-23": "r1-guilherme",
  "2026-11-24": "r1-roosewelt",
  "2026-11-25": "r1-augusto",
  "2026-11-26": "r3-raffaela",
  "2026-11-27": "r1-roosewelt",
  "2026-11-28": "r1-guilherme",
  "2026-11-29": "r1-roosewelt",
  "2026-11-30": "r2-daniel",
  "2026-12-01": "r3-raffaela",
  "2026-12-02": "r2-daniel",
  "2026-12-03": "r3-wagner",
  "2026-12-04": "r3-raffaela",
  "2026-12-05": "r1-roosewelt",
  "2026-12-06": "r2-jacinta",
  "2026-12-07": "r2-daniel",
  "2026-12-08": "r3-wagner",
  "2026-12-09": "r1-roosewelt",
  "2026-12-10": "r2-rodrigo",
  "2026-12-11": "r3-wagner",
  "2026-12-12": "r2-jacinta",
  "2026-12-13": "r1-roosewelt",
  "2026-12-14": "r2-rodrigo",
  "2026-12-15": "r3-raffaela",
  "2026-12-16": "r1-augusto",
  "2026-12-17": "r2-jacinta",
  "2026-12-18": "r1-guilherme",
  "2026-12-19": "r1-augusto",
  "2026-12-20": "r2-daniel",
  "2026-12-21": "r1-roosewelt",
  "2026-12-22": "r2-daniel",
  "2026-12-23": "r2-rodrigo",
  "2026-12-24": "r1-roosewelt",
  "2026-12-25": "r1-augusto",
  "2026-12-26": "r2-rodrigo",
  "2026-12-27": "r3-raffaela",
  "2026-12-28": "r2-jacinta",
  "2026-12-29": "r1-guilherme",
  "2026-12-30": "r3-wagner",
  "2026-12-31": "r1-guilherme",
  "2027-01-01": "r2-jacinta",
  "2027-01-02": "r3-wagner",
  "2027-01-03": "r2-jacinta",
  "2027-01-04": "r1-roosewelt",
  "2027-01-05": "r3-wagner",
  "2027-01-06": "r1-roosewelt",
  "2027-01-07": "r1-augusto",
  "2027-01-08": "r3-wagner",
  "2027-01-09": "r1-guilherme",
  "2027-01-10": "r2-rodrigo",
  "2027-01-11": "r2-daniel",
  "2027-01-12": "r1-augusto",
  "2027-01-13": "r2-jacinta",
  "2027-01-14": "r3-wagner",
  "2027-01-15": "r1-guilherme",
  "2027-01-16": "r1-augusto",
  "2027-01-17": "r2-daniel",
  "2027-01-18": "r3-raffaela",
  "2027-01-19": "r1-guilherme",
  "2027-01-20": "r1-roosewelt",
  "2027-01-21": "r2-rodrigo",
  "2027-01-22": "r1-augusto",
  "2027-01-23": "r3-raffaela",
  "2027-01-24": "r1-roosewelt",
  "2027-01-25": "r2-rodrigo",
  "2027-01-26": "r3-raffaela",
  "2027-01-27": "r2-jacinta",
  "2027-01-28": "r3-raffaela",
  "2027-01-29": "r2-daniel",
  "2027-01-30": "r1-guilherme",
  "2027-01-31": "r2-daniel",
  "2027-02-01": "r3-wagner",
  "2027-02-02": "r2-daniel",
  "2027-02-03": "r2-jacinta",
  "2027-02-04": "r3-wagner",
  "2027-02-05": "r1-guilherme",
  "2027-02-06": "r3-raffaela",
  "2027-02-07": "r2-daniel",
  "2027-02-08": "r3-raffaela",
  "2027-02-09": "r2-rodrigo",
  "2027-02-10": "r1-guilherme",
  "2027-02-11": "r3-raffaela",
  "2027-02-12": "r1-roosewelt",
  "2027-02-13": "r1-guilherme",
  "2027-02-14": "r2-rodrigo",
  "2027-02-15": "r3-wagner",
  "2027-02-16": "r1-augusto",
  "2027-02-17": "r3-raffaela",
  "2027-02-18": "r2-rodrigo",
  "2027-02-19": "r2-jacinta",
  "2027-02-20": "r1-roosewelt",
  "2027-02-21": "r1-augusto",
  "2027-02-22": "r2-rodrigo",
  "2027-02-23": "r1-roosewelt",
  "2027-02-24": "r1-augusto",
  "2027-02-25": "r1-roosewelt",
  "2027-02-26": "r1-guilherme",
  "2027-02-27": "r2-daniel",
  "2027-02-28": "r2-jacinta"
}

export const ROTACOES: Quinzena[] = [
  {
    "inicio": "2026-03-01",
    "fim": "2026-03-15",
    "estagios": {
      "r3-wagner": "Torácica",
      "r3-raffaela": "APA",
      "r2-daniel": "Bloqueios",
      "r2-jacinta": "Neuro",
      "r2-rodrigo": "GO/Emerg",
      "r1-augusto": "Adaptação",
      "r1-guilherme": "Adaptação",
      "r1-roosewelt": "Adaptação"
    }
  },
  {
    "inicio": "2026-03-16",
    "fim": "2026-03-31",
    "estagios": {
      "r3-wagner": "Srpa",
      "r3-raffaela": "GO/Emerg",
      "r2-daniel": "Neuro",
      "r2-jacinta": "APA",
      "r2-rodrigo": "Bloqueios",
      "r1-augusto": "Adaptação",
      "r1-guilherme": "Adaptação",
      "r1-roosewelt": "Adaptação"
    }
  },
  {
    "inicio": "2026-04-01",
    "fim": "2026-04-15",
    "estagios": {
      "r3-wagner": "Infantil",
      "r3-raffaela": "Torácica",
      "r2-daniel": "APA",
      "r2-jacinta": "Onco",
      "r2-rodrigo": "Neuro",
      "r1-augusto": "Uro/Procto",
      "r1-guilherme": "Ortopedia",
      "r1-roosewelt": "Cx Geral"
    }
  },
  {
    "inicio": "2026-04-16",
    "fim": "2026-04-30",
    "estagios": {
      "r3-wagner": "Onco",
      "r3-raffaela": "Neuro",
      "r2-daniel": "Torácica",
      "r2-jacinta": "Infantil",
      "r2-rodrigo": "APA",
      "r1-augusto": "Ortopedia",
      "r1-guilherme": "GO/Emerg",
      "r1-roosewelt": "Uro/Procto"
    }
  },
  {
    "inicio": "2026-05-01",
    "fim": "2026-05-15",
    "estagios": {
      "r3-wagner": "APA",
      "r3-raffaela": "Optativo",
      "r2-daniel": "UTI",
      "r2-jacinta": "Srpa",
      "r2-rodrigo": "Torácica",
      "r1-augusto": "Cx/Geral",
      "r1-guilherme": "Uro/Procto",
      "r1-roosewelt": "Ortopedia"
    }
  },
  {
    "inicio": "2026-05-16",
    "fim": "2026-05-30",
    "estagios": {
      "r3-wagner": "Neuro",
      "r3-raffaela": "Optativo",
      "r2-daniel": "UTI",
      "r2-jacinta": "Onco",
      "r2-rodrigo": "Férias",
      "r1-augusto": "Ortopedia",
      "r1-guilherme": "APA",
      "r1-roosewelt": "GO/Emerg"
    }
  },
  {
    "inicio": "2026-06-01",
    "fim": "2026-06-15",
    "estagios": {
      "r3-wagner": "Bloqueio",
      "r3-raffaela": "Infantil",
      "r2-daniel": "Onco",
      "r2-jacinta": "Férias",
      "r2-rodrigo": "UTI",
      "r1-augusto": "GO/Emerg",
      "r1-guilherme": "Cx Geral",
      "r1-roosewelt": "APA"
    }
  },
  {
    "inicio": "2026-06-16",
    "fim": "2026-06-30",
    "estagios": {
      "r3-wagner": "Torácica",
      "r3-raffaela": "Neuro",
      "r2-daniel": "Infantil",
      "r2-jacinta": "Bloqueio",
      "r2-rodrigo": "UTI",
      "r1-augusto": "APA",
      "r1-guilherme": "GO/Emerg",
      "r1-roosewelt": "Férias"
    }
  },
  {
    "inicio": "2026-07-01",
    "fim": "2026-07-15",
    "estagios": {
      "r3-wagner": "Onco",
      "r3-raffaela": "Bloqueio",
      "r2-daniel": "Neuro",
      "r2-jacinta": "UTI",
      "r2-rodrigo": "Infantil",
      "r1-augusto": "Férias",
      "r1-guilherme": "APA",
      "r1-roosewelt": "Srpa"
    }
  },
  {
    "inicio": "2026-07-16",
    "fim": "2026-07-31",
    "estagios": {
      "r3-wagner": "Infantil",
      "r3-raffaela": "Torácica",
      "r2-daniel": "Férias",
      "r2-jacinta": "UTI",
      "r2-rodrigo": "APA",
      "r1-augusto": "Cx Geral",
      "r1-guilherme": "Ortopedia",
      "r1-roosewelt": "GO/Emerg"
    }
  },
  {
    "inicio": "2026-08-01",
    "fim": "2026-08-15",
    "estagios": {
      "r3-wagner": "Torácica",
      "r3-raffaela": "Onco",
      "r2-daniel": "GO/Emerg",
      "r2-jacinta": "Infantil",
      "r2-rodrigo": "Neuro",
      "r1-augusto": "UTI",
      "r1-guilherme": "Ferias",
      "r1-roosewelt": "APA"
    }
  },
  {
    "inicio": "2026-08-16",
    "fim": "2026-08-31",
    "estagios": {
      "r3-wagner": "Neuro",
      "r3-raffaela": "Optativo",
      "r2-daniel": "Infantil",
      "r2-jacinta": "APA",
      "r2-rodrigo": "Onco",
      "r1-augusto": "UTI",
      "r1-guilherme": "Cx Geral",
      "r1-roosewelt": "Ortopedia"
    }
  },
  {
    "inicio": "2026-09-01",
    "fim": "2026-09-15",
    "estagios": {
      "r3-wagner": "Optativo",
      "r3-raffaela": "Férias",
      "r2-daniel": "APA",
      "r2-jacinta": "Torácica",
      "r2-rodrigo": "Neuro",
      "r1-augusto": "Ortopedia",
      "r1-guilherme": "Uro/Procto",
      "r1-roosewelt": "UTI"
    }
  },
  {
    "inicio": "2026-09-16",
    "fim": "2026-09-30",
    "estagios": {
      "r3-wagner": "Infantil",
      "r3-raffaela": "Onco",
      "r2-daniel": "Neuro",
      "r2-jacinta": "Férias",
      "r2-rodrigo": "Srpa",
      "r1-augusto": "APA",
      "r1-guilherme": "Ortopedia",
      "r1-roosewelt": "UTI"
    }
  },
  {
    "inicio": "2026-10-01",
    "fim": "2026-10-15",
    "estagios": {
      "r3-wagner": "Onco",
      "r3-raffaela": "Infantil",
      "r2-daniel": "Férias",
      "r2-jacinta": "Neuro",
      "r2-rodrigo": "APA",
      "r1-augusto": "Uro/Procto",
      "r1-guilherme": "UTI",
      "r1-roosewelt": "Cx Geral"
    }
  },
  {
    "inicio": "2026-10-16",
    "fim": "2026-10-31",
    "estagios": {
      "r3-wagner": "Férias",
      "r3-raffaela": "Bloqueio",
      "r2-daniel": "Neuro",
      "r2-jacinta": "Onco",
      "r2-rodrigo": "Torácica",
      "r1-augusto": "Srpa",
      "r1-guilherme": "UTI",
      "r1-roosewelt": "APA"
    }
  },
  {
    "inicio": "2026-11-01",
    "fim": "2026-11-15",
    "estagios": {
      "r3-wagner": "Neuro",
      "r3-raffaela": "Imagem/Braqui",
      "r2-daniel": "Infantil",
      "r2-jacinta": "APA",
      "r2-rodrigo": "Bloqueio",
      "r1-augusto": "GO/Emerg",
      "r1-guilherme": "Cx Geral",
      "r1-roosewelt": "Férias"
    }
  },
  {
    "inicio": "2026-11-16",
    "fim": "2026-11-30",
    "estagios": {
      "r3-wagner": "Optativo",
      "r3-raffaela": "Infantil",
      "r2-daniel": "APA",
      "r2-jacinta": "Torácica",
      "r2-rodrigo": "Férias",
      "r1-augusto": "Cx Geral",
      "r1-guilherme": "Srpa",
      "r1-roosewelt": "Ortopedia"
    }
  },
  {
    "inicio": "2026-12-01",
    "fim": "2026-12-15",
    "estagios": {
      "r3-wagner": "GO/Emerg",
      "r3-raffaela": "Torácica",
      "r2-daniel": "Bloqueio",
      "r2-jacinta": "Neuro",
      "r2-rodrigo": "Onco",
      "r1-augusto": "APA",
      "r1-guilherme": "Férias",
      "r1-roosewelt": "Srpa"
    }
  },
  {
    "inicio": "2026-12-16",
    "fim": "2026-12-31",
    "estagios": {
      "r3-wagner": "Infantil",
      "r3-raffaela": "Srpa",
      "r2-daniel": "Torácica",
      "r2-jacinta": "GO/Emerg",
      "r2-rodrigo": "Neuro",
      "r1-augusto": "Cx Geral",
      "r1-guilherme": "Ortopedia",
      "r1-roosewelt": "Uro/Procto"
    }
  },
  {
    "inicio": "2027-01-01",
    "fim": "2027-01-15",
    "estagios": {
      "r3-wagner": "Onco",
      "r3-raffaela": "Férias",
      "r2-daniel": "Onco",
      "r2-jacinta": "Torácica",
      "r2-rodrigo": "Infantil",
      "r1-augusto": "Ortopedia",
      "r1-guilherme": "APA",
      "r1-roosewelt": "Cx Geral"
    }
  },
  {
    "inicio": "2027-01-16",
    "fim": "2027-01-31",
    "estagios": {
      "r3-wagner": "Férias",
      "r3-raffaela": "Unimed",
      "r2-daniel": "Srpa",
      "r2-jacinta": "Neuro",
      "r2-rodrigo": "Onco",
      "r1-augusto": "APA",
      "r1-guilherme": "Cx Geral",
      "r1-roosewelt": "Ortopedia"
    }
  },
  {
    "inicio": "2027-02-01",
    "fim": "2027-02-15",
    "estagios": {
      "r3-wagner": "Unimed",
      "r3-raffaela": "Onco",
      "r2-daniel": "Torácica",
      "r2-jacinta": "Bloqueio",
      "r2-rodrigo": "Infantil",
      "r1-augusto": "Férias",
      "r1-guilherme": "Srpa",
      "r1-roosewelt": "APA"
    }
  },
  {
    "inicio": "2027-02-16",
    "fim": "2027-02-28",
    "estagios": {
      "r3-wagner": "Bloqueio",
      "r3-raffaela": "Neuro",
      "r2-daniel": "Onco",
      "r2-jacinta": "Infantil",
      "r2-rodrigo": "Torácica",
      "r1-augusto": "Srpa",
      "r1-guilherme": "APA",
      "r1-roosewelt": "Cx Geral"
    }
  }
]

/** Feriados da residência (sáb/dom/feriado = plantão 24h; sem estágio). */
export const FERIADOS_RESIDENCIA: Record<string, string | null> = {
  "2026-04-03": "Sexta-Feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-08-25": "DIA DO MUNICÍPIO",
  "2026-09-07": "Independência do Brasil",
  "2026-10-12": "Nossa Senhora de Aparecida",
  "2026-11-02": "Finados (Dia dos Mortos)",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Consciência Negra",
  "2026-12-24": "FERIADO",
  "2026-12-25": "Natal",
  "2026-12-31": "FERIADO",
  "2027-01-01": "Ano Novo",
  "2027-02-09": "Carnaval (Terça-Feira)"
}

/** Feriados das funcionárias (24/12 e 31/12 são dia útil para elas). */
export const FERIADOS_FUNCIONARIAS: Record<string, string> = {
  "2026-04-03": "Sexta-Feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-08-25": "DIA DO MUNICÍPIO",
  "2026-09-07": "Independência do Brasil",
  "2026-10-12": "Nossa Senhora de Aparecida",
  "2026-11-02": "Finados (Dia dos Mortos)",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Consciência Negra",
  "2026-12-25": "Natal",
  "2027-01-01": "Ano Novo",
  "2027-02-09": "Carnaval (Terça-Feira)"
}

export const FUNCIONARIAS_SOBREAVISO: Pessoa[] = [
  {
    "id": "marta",
    "nome": "Marta"
  },
  {
    "id": "renata",
    "nome": "Renata"
  },
  {
    "id": "luciana",
    "nome": "Luciana"
  },
  {
    "id": "elisete",
    "nome": "Elisete"
  },
  {
    "id": "saionara",
    "nome": "Saionara"
  },
  {
    "id": "mari",
    "nome": "Mari"
  }
]

export const FUNCIONARIAS_HOSPITAIS: Pessoa[] = [
  {
    "id": "marta",
    "nome": "Marta"
  },
  {
    "id": "renata",
    "nome": "Renata"
  },
  {
    "id": "luciana",
    "nome": "Luciana"
  },
  {
    "id": "elisete",
    "nome": "Elisete"
  },
  {
    "id": "saionara",
    "nome": "Saionara"
  },
  {
    "id": "mari",
    "nome": "Mari"
  }
]

/** dateKey → funcionariaId. Meses publicados no app (escalasFuncionarias) substituem o mês inteiro. */
export const SOBREAVISO_BASE_ESTATICA: Record<string, string> = {
  "2026-04-01": "marta",
  "2026-04-02": "renata",
  "2026-04-03": "luciana",
  "2026-04-04": "renata",
  "2026-04-05": "elisete",
  "2026-04-06": "marta",
  "2026-04-07": "luciana",
  "2026-04-08": "marta",
  "2026-04-09": "renata",
  "2026-04-10": "renata",
  "2026-04-11": "elisete",
  "2026-04-12": "elisete",
  "2026-04-13": "saionara",
  "2026-04-14": "marta",
  "2026-04-15": "renata",
  "2026-04-16": "luciana",
  "2026-04-17": "marta",
  "2026-04-18": "saionara",
  "2026-04-19": "elisete",
  "2026-04-20": "saionara",
  "2026-04-21": "elisete",
  "2026-04-22": "luciana",
  "2026-04-23": "saionara",
  "2026-04-24": "marta",
  "2026-04-25": "elisete",
  "2026-04-26": "luciana",
  "2026-04-27": "saionara",
  "2026-04-28": "luciana",
  "2026-04-29": "saionara",
  "2026-04-30": "renata",
  "2026-05-01": "saionara",
  "2026-05-02": "elisete",
  "2026-05-03": "elisete",
  "2026-05-04": "renata",
  "2026-05-05": "saionara",
  "2026-05-06": "luciana",
  "2026-05-07": "renata",
  "2026-05-08": "marta",
  "2026-05-09": "renata",
  "2026-05-10": "elisete",
  "2026-05-11": "luciana",
  "2026-05-12": "marta",
  "2026-05-13": "saionara",
  "2026-05-14": "marta",
  "2026-05-15": "luciana",
  "2026-05-16": "marta",
  "2026-05-17": "elisete",
  "2026-05-18": "marta",
  "2026-05-19": "renata",
  "2026-05-20": "saionara",
  "2026-05-21": "luciana",
  "2026-05-22": "renata",
  "2026-05-23": "saionara",
  "2026-05-24": "elisete",
  "2026-05-25": "marta",
  "2026-05-26": "luciana",
  "2026-05-27": "renata",
  "2026-05-28": "saionara",
  "2026-05-29": "luciana",
  "2026-05-30": "elisete",
  "2026-05-31": "elisete",
  "2026-06-01": "saionara",
  "2026-06-02": "marta",
  "2026-06-03": "luciana",
  "2026-06-04": "elisete",
  "2026-06-05": "renata",
  "2026-06-06": "elisete",
  "2026-06-07": "elisete",
  "2026-06-08": "marta",
  "2026-06-09": "luciana",
  "2026-06-10": "renata",
  "2026-06-11": "saionara",
  "2026-06-12": "renata",
  "2026-06-13": "luciana",
  "2026-06-14": "elisete",
  "2026-06-15": "renata",
  "2026-06-16": "saionara",
  "2026-06-17": "marta",
  "2026-06-18": "luciana",
  "2026-06-19": "saionara",
  "2026-06-20": "elisete",
  "2026-06-21": "marta",
  "2026-06-22": "marta",
  "2026-06-23": "luciana",
  "2026-06-24": "renata",
  "2026-06-25": "saionara",
  "2026-06-26": "marta",
  "2026-06-27": "elisete",
  "2026-06-28": "saionara",
  "2026-06-29": "renata",
  "2026-06-30": "luciana",
  "2026-07-01": "renata",
  "2026-07-02": "saionara",
  "2026-07-03": "luciana",
  "2026-07-04": "elisete",
  "2026-07-05": "elisete",
  "2026-07-06": "marta",
  "2026-07-07": "saionara",
  "2026-07-08": "luciana",
  "2026-07-09": "renata",
  "2026-07-10": "saionara",
  "2026-07-11": "luciana",
  "2026-07-12": "elisete",
  "2026-07-13": "marta",
  "2026-07-14": "luciana",
  "2026-07-15": "renata",
  "2026-07-16": "saionara",
  "2026-07-17": "luciana",
  "2026-07-18": "marta",
  "2026-07-19": "elisete",
  "2026-07-20": "saionara",
  "2026-07-21": "renata",
  "2026-07-22": "marta",
  "2026-07-23": "luciana",
  "2026-07-24": "renata",
  "2026-07-25": "elisete",
  "2026-07-26": "elisete",
  "2026-07-27": "marta",
  "2026-07-28": "luciana",
  "2026-07-29": "renata",
  "2026-07-30": "saionara",
  "2026-07-31": "marta",
  "2026-08-01": "elisete",
  "2026-08-02": "elisete",
  "2026-08-03": "saionara",
  "2026-08-04": "saionara",
  "2026-08-05": "luciana",
  "2026-08-06": "marta",
  "2026-08-07": "saionara",
  "2026-08-08": "renata",
  "2026-08-09": "elisete",
  "2026-08-10": "saionara",
  "2026-08-11": "saionara",
  "2026-08-12": "luciana",
  "2026-08-13": "saionara",
  "2026-08-14": "luciana",
  "2026-08-15": "renata",
  "2026-08-16": "elisete",
  "2026-08-17": "marta",
  "2026-08-18": "luciana",
  "2026-08-19": "renata",
  "2026-08-20": "marta",
  "2026-08-21": "renata",
  "2026-08-22": "luciana",
  "2026-08-23": "renata",
  "2026-08-24": "luciana",
  "2026-08-25": "renata",
  "2026-08-26": "marta",
  "2026-08-27": "renata",
  "2026-08-28": "marta",
  "2026-08-29": "elisete",
  "2026-08-30": "elisete",
  "2026-08-31": "marta"
}

/** dateKey → NOMES por slot (a base de hospitais guarda nome, não id). */
export const HOSPITAIS_BASE_ESTATICA: Record<string, HospitaisDia> = {
  "2026-04-03": {
    "hro": "Luciana",
    "unimed": "Renata",
    "plantaoPago": "Mari"
  },
  "2026-04-04": {
    "hro": "Renata",
    "unimed": "Mari",
    "plantaoPago": "Luciana"
  },
  "2026-04-05": {
    "hro": "Renata",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-04-11": {
    "hro": "Luciana",
    "unimed": "Elisete",
    "plantaoPago": "Renata"
  },
  "2026-04-12": {
    "hro": "Luciana",
    "unimed": null,
    "plantaoPago": "Renata"
  },
  "2026-04-18": {
    "hro": "Mari",
    "unimed": "Elisete",
    "plantaoPago": "Saionara"
  },
  "2026-04-19": {
    "hro": "Saionara",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-04-21": {
    "hro": "Elisete",
    "unimed": "Saionara",
    "plantaoPago": "Luciana"
  },
  "2026-04-25": {
    "hro": "Elisete",
    "unimed": "Saionara",
    "plantaoPago": "Marta"
  },
  "2026-04-26": {
    "hro": "Marta",
    "unimed": null,
    "plantaoPago": "Saionara"
  },
  "2026-05-01": {
    "hro": "Elisete",
    "unimed": "Saionara",
    "plantaoPago": "Mari"
  },
  "2026-05-02": {
    "hro": "Elisete",
    "unimed": "Mari",
    "plantaoPago": "Saionara"
  },
  "2026-05-03": {
    "hro": "Elisete",
    "unimed": null,
    "plantaoPago": "Saionara"
  },
  "2026-05-09": {
    "hro": "Marta",
    "unimed": "Renata",
    "plantaoPago": "Luciana"
  },
  "2026-05-10": {
    "hro": "Marta",
    "unimed": null,
    "plantaoPago": "Luciana"
  },
  "2026-05-16": {
    "hro": "Mari",
    "unimed": "Marta",
    "plantaoPago": "Luciana"
  },
  "2026-05-17": {
    "hro": "Luciana",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-05-23": {
    "hro": "Saionara",
    "unimed": "Luciana",
    "plantaoPago": "Renata"
  },
  "2026-05-24": {
    "hro": "Renata",
    "unimed": null,
    "plantaoPago": "Saionara"
  },
  "2026-05-30": {
    "hro": "Renata",
    "unimed": "Elisete",
    "plantaoPago": "Mari"
  },
  "2026-05-31": {
    "hro": "Elisete",
    "unimed": null,
    "plantaoPago": "Renata"
  },
  "2026-06-04": {
    "hro": "Luciana",
    "unimed": "Elisete",
    "plantaoPago": "Renata"
  },
  "2026-06-06": {
    "hro": "Elisete",
    "unimed": "Luciana",
    "plantaoPago": "Renata"
  },
  "2026-06-07": {
    "hro": "Elisete",
    "unimed": null,
    "plantaoPago": "Renata"
  },
  "2026-06-13": {
    "hro": "Luciana",
    "unimed": "Mari",
    "plantaoPago": "Renata"
  },
  "2026-06-14": {
    "hro": "Luciana",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-06-20": {
    "hro": "Elisete",
    "unimed": "Saionara",
    "plantaoPago": "Marta"
  },
  "2026-06-21": {
    "hro": "Marta",
    "unimed": null,
    "plantaoPago": "Saionara"
  },
  "2026-06-27": {
    "hro": "Mari",
    "unimed": "Elisete",
    "plantaoPago": "Saionara"
  },
  "2026-06-28": {
    "hro": "Saionara",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-07-04": {
    "hro": "Elisete",
    "unimed": "Luciana",
    "plantaoPago": "Saionara"
  },
  "2026-07-05": {
    "hro": "Elisete",
    "unimed": null,
    "plantaoPago": "Luciana"
  },
  "2026-07-11": {
    "hro": "Luciana",
    "unimed": "Mari",
    "plantaoPago": "Renata"
  },
  "2026-07-12": {
    "hro": "Renata",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-07-18": {
    "hro": "Mari",
    "unimed": "Marta",
    "plantaoPago": "Saionara"
  },
  "2026-07-19": {
    "hro": "Marta",
    "unimed": null,
    "plantaoPago": "Saionara"
  },
  "2026-07-25": {
    "hro": "Renata",
    "unimed": "Elisete",
    "plantaoPago": "Luciana"
  },
  "2026-07-26": {
    "hro": "Elisete",
    "unimed": null,
    "plantaoPago": "Renata"
  },
  "2026-08-01": {
    "hro": "Saionara",
    "unimed": "Elisete",
    "plantaoPago": "Luciana"
  },
  "2026-08-02": {
    "hro": "Luciana",
    "unimed": null,
    "plantaoPago": "Saionara"
  },
  "2026-08-08": {
    "hro": "Renata",
    "unimed": "Mari",
    "plantaoPago": "Saionara"
  },
  "2026-08-09": {
    "hro": "Saionara",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-08-15": {
    "hro": "Elisete",
    "unimed": "Renata",
    "plantaoPago": "Marta"
  },
  "2026-08-16": {
    "hro": "Marta",
    "unimed": null,
    "plantaoPago": "Renata"
  },
  "2026-08-22": {
    "hro": "Luciana",
    "unimed": "Mari",
    "plantaoPago": "Renata"
  },
  "2026-08-23": {
    "hro": "Renata",
    "unimed": null,
    "plantaoPago": "Mari"
  },
  "2026-08-25": {
    "hro": "Elisete",
    "unimed": "Renata",
    "plantaoPago": "Luciana"
  },
  "2026-08-29": {
    "hro": "Mari",
    "unimed": "Elisete",
    "plantaoPago": "Luciana"
  },
  "2026-08-30": {
    "hro": "Elisete",
    "unimed": null,
    "plantaoPago": "Luciana"
  }
}
