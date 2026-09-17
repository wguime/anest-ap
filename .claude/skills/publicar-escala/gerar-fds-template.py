#!/usr/bin/env python3
# FIM DE SEMANA — transcrição da tabela "ESCALA DE FINAL DE SEMANA" (foto 1) + um mapa por hospital
# por dia (Unimed sáb, HRO sáb, Unimed dom, HRO dom). Copiar para .tmp/escala-lote/<sábado>-fds/gerar.py.
# Recado do dono: (cole aqui — acréscimo por texto vira caso a mais no mapa do hospital do cirurgião)
#   • …
import os, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '.claude', 'skills', 'publicar-escala'))
from lote import Mapa, salvar_fds

D = os.path.dirname(os.path.abspath(__file__))
SAB, DOM = 'AAAA-MM-DD', 'AAAA-MM-DD'

# m.add(sala, hora, paciente, idade, procedimento, cirurgiao, anestesista, convenio[, cor[, tempo[, bloco]]])
#   anestesista: nome da foto · '//' (igual à linha de cima, mesma sala) · '' (célula VAZIA — a lib decide:
#   "?" ou o posto na manhã de sábado) · '?' só quando o documento escreve "?".
#   m.vesp() ao cruzar o título VESPERTINO do documento — as linhas "AS" só têm turno pela faixa.
VD, IE, IN_, MERC, PART = ('UNIMED CHAPECO - VD', 'UNIMED INTERCAMBIO ESTADUAL', 'UNIMED INTERCAMBIO NACIONAL',
                           'INTERCAMBIO MERCOSUL - PR/RS', 'PARTICULAR')

# ── SÁBADO — UNIMED ───────────────────────────────────────────────────────────
su = Mapa('unimed', SAB)
# su.add('C.O - CESAREA', '07:30', 'NOME', '36a 8m 21d', 'CESARIANA', 'CIRURGIAO', 'VICENTE', VD, 'amarelo', '01:15')
# su.add('CENTRO CIRÚRGICO - SALA 1', '07:30', 'NOME', '0a 0m 15d', 'PROCEDIMENTO', 'CIRURGIAO', 'STAUB', MERC, '', '01:15')
# su.add('CENTRO CIRÚRGICO - SALA 1', '09:00', 'NOME', '38a 8m 30d', 'PROCEDIMENTO', 'CIRURGIAO', '//', VD, '', '04:00')
# su.add('EXAMES', '09:00', '', '', '01 COLO C/ EDA (PCTE INTERNADO)', 'LEONARDO', 'VICENTE', '', 'amarelo')
# su.vesp()   # ← VESPERTINO: costuma vir SEM anestesista → ''
# su.add('CENTRO CIRÚRGICO - SALA 1', '13:30', 'NOME', '54a 2m 3d', 'PROCEDIMENTO', 'CIRURGIAO', '', VD, '', '02:15')

# ── SÁBADO — HRO ──────────────────────────────────────────────────────────────
sh = Mapa('hro', SAB)
# sh.add('Sala 1', '07:00', 'Nome Sobrenome', '52', 'PROCEDIMENTO', 'Cirurgiao', 'JOAO HENRIQUE', 'PART')
# sh.add('Sala 2', 'AS', 'Nome Sobrenome', '14', 'PROCEDIMENTO', 'Cirurgiao', '//', 'BRF')
# sh.add('SIMONE', '08:00', '', '', '01 PROCEDIMENTO', '', 'PED COSTA', '', bloco='simone')
# sh.vesp()
# sh.add('Sala 4', '13:00', 'Nome Sobrenome', '54', 'PROCEDIMENTO', 'Cirurgiao', '', 'SUS')

# ── DOMINGO — UNIMED ──────────────────────────────────────────────────────────
du = Mapa('unimed', DOM)
# du.add(...)
# du.vesp()

# ── DOMINGO — HRO ─────────────────────────────────────────────────────────────
dh = Mapa('hro', DOM)
# dh.add('Sala 4', '07:00', '', '', 'CO/EMERG.', '', 'JOAO HENRIQUE', 'SUS')   # linha de C.O/emergência sem paciente, como vem
# dh.vesp()

# ── TABELA DE POSIÇÕES (foto 1) ───────────────────────────────────────────────
# Só o sábado tem a grade rotulada (P1 NOME…); o domingo herda e a COR diz a troca pessoal
# (nome novo na cor de um Pn → só essa posição em `posicoes` do domingo).
POSICOES_SAB = {'P1': '', 'P2': '', 'P3': '', 'P4': '', 'P5': '', 'P6': '', 'P7': '', 'P8': '',
                'P9': '', 'P10': '', 'P11': '', 'P12': ''}
lote = {
    'sabado': SAB,
    'dias': {
        SAB: {
            'grade': {  # 3 faixas × unimed / hro / ret1 / ret2, como está na tabela
                '7-13':  {'unimed': '', 'hro': '', 'ret1': '', 'ret2': ''},
                '13-19': {'unimed': '', 'hro': '', 'ret1': '', 'ret2': ''},
                '19-07': {'unimed': '', 'hro': '', 'ret1': '', 'ret2': ''},
            },
            'posicoes': POSICOES_SAB,
            # Pn por turno, na ordem da lista numerada do documento
            'escalacao': {'matutino': [], 'vespertino': []},
            # a linha "1º → último a ser LIBERADO" COMO ESTÁ no documento (a inversão é do script);
            # linha ausente = [] (sugestão pela escalação, marcada "sugerida"); noite SEMPRE []
            'ordemDoc': {'matutino': [], 'vespertino': [], 'noturno': []},
        },
        DOM: {
            'grade': {
                '7-13':  {'unimed': '', 'hro': '', 'ret1': '', 'ret2': ''},
                '13-19': {'unimed': '', 'hro': '', 'ret1': '', 'ret2': ''},
                '19-07': {'unimed': '', 'hro': '', 'ret1': '', 'ret2': ''},
            },
            'posicoes': {},                                   # só a troca pessoal ('P3': 'KLISMAN'); o resto herda o sábado
            'escalacao': {'matutino': [], 'vespertino': []},  # bloco "8º X 7º Y · EMERGENCIA: 11º Z" → ['P8','P7','P11'] nos dois
            'ordemDoc': {'matutino': [], 'vespertino': [], 'noturno': []},
        },
    },
    # PLANTÃO MATERNO são funcionárias (MARTA, ELISETE), nunca posição — só para o relatório
    'ignorados': [],
    'mapas': [su.payload(), sh.payload(), du.payload(), dh.payload()],
}

salvar_fds(D, lote)
