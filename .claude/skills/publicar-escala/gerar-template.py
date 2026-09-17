#!/usr/bin/env python3
# Transcrição das fotos de DD/MM HHhMM (TURNO de DD/MM/AAAA) — Unimed, HRO e Materno.
# Recado do dono: (cole aqui, uma linha por item, e o que cada um virou no lote)
#   • …
# Copiar para .tmp/escala-lote/<data>-<turno>/gerar.py e preencher SÓ as tabelas. Convenções na
# "Ficha" da SKILL.md; helpers em lote.py (iniciais, particular, ordem por sala, resumo).
import os, sys
sys.dont_write_bytecode = True  # senão nasce um __pycache__ untracked dentro da skill
# .tmp/escala-lote/<data>-<turno>/gerar.py → três níveis acima é a raiz do repo
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '.claude', 'skills', 'publicar-escala'))
from lote import hospital, salvar

D = os.path.dirname(os.path.abspath(__file__))
DATA, TURNO = 'AAAA-MM-DD', 'vespertino'  # matutino | vespertino

# Linha = (sala, hora, paciente, idade, procedimento, cirurgiao, anestesista, convenio[, cor[, tempo[, cont]]])
#   sala      = rótulo da FOTO (o normalizador canoniza) — ver Ficha
#   hora      = "HH:MM" ou "AS"; anestesista = nome da foto, "//" (igual à linha de cima, MESMA sala), "?" (descoberta)
#   convenio  = como está; PARTICULAR/PART leva o nome do paciente sozinho (cobrança)
#   cor       = 'azul' (ajuda de outro hospital → também em ajuda=…) | 'amarelo' (dois locais de propósito)
#   cont=True = "CONTINUAÇÃO …" (caso da manhã que atravessa)

# ── UNIMED (data em cada linha da planilha) ───────────────────────────────────
VD, IE, IN_, MERC, PART, FUND = ('UNIMED CHAPECO - VD', 'UNIMED INTERCAMBIO ESTADUAL', 'UNIMED INTERCAMBIO NACIONAL',
                                 'INTERCAMBIO MERCOSUL - PR/RS', 'PARTICULAR', 'UNIMED FUNDACAO')
UNI = [
    # ('C.O - CESAREA', '17:30', 'NOME COMPLETO', '43a 0m 19d', 'CESARIANA', 'CIRURGIAO', '?', FUND, '', '01:15'),
    # ('CENTRO CIRÚRGICO - SALA 1', '13:30', 'NOME', '20a 5m 6d', 'PROCEDIMENTO', 'CIRURGIAO', 'RAUL', VD, '', '01:00'),
    # ('CENTRO CIRÚRGICO - SALA 1', '14:45', 'NOME', '31a 5m 7d', 'PROCEDIMENTO', 'CIRURGIAO', '//', VD, '', '01:00'),
    # seções de baixo (sem paciente): EXAMES · IMAGEM · ACCURATA · UMANITA · CLINICA CIRURGICA
    # ('EXAMES', '13:30', '', '', '06 EDA + 04 COLO (06 PCTES)', 'ENDOSCOPISTA', 'JOAO RICARDO', ''),
    # ('UMANITA', '13:00', '', '', 'CONTINUAÇÃO +-14H30', 'LUCAS', 'NATHALIA', '', '', '', True),
]
unimed = hospital(
    'unimed', UNI, data=DATA,
    posicoes=[('SRPA', 'NOME')],                      # linha solta "SRPA | NOME"
    ordem=[],                                         # rodapé vermelho, NA ORDEM da foto, com "(CONSULT)" quando houver
    ajuda=[],                                         # nomes em AZUL aqui (quem vem de fora); a ÚLTIMA do array sai primeiro
    ajuda_ordem_informada=False,                      # True quando o dono NUMEROU a ordem das ajudas no recado
)

# ── HRO (título "DD/MM/AAAA – HRO"; sem data → data='' e o aviso aparece) ─────
HRO = [
    # Bloco A → 'Sala N'; Bloco M → 'Bloco M - Sala N' ("//" NÃO herda entre salas do Bloco M)
    # ('Sala 1', '13:00', '', '', 'CONTINUAÇÃO', 'Cirurgiao', 'JOAO HENRIQUE', 'SUS', '', '', True),
    # ('Sala 4', '13:00', 'Nome Sobrenome', '24a', 'PROCEDIMENTO', 'Cirurgiao', 'LOUISE', 'SUS'),
    # ('Sala 4', 'AS', 'Nome Sobrenome', '66a', 'PROCEDIMENTO', 'Cirurgiao', '//', 'SUS'),
    # ('C.O', '13:00', '', '', 'CENTRO OBSTETRICO – 01 CESAREA', '', 'CURY', ''),
    # ('Bloco M - Sala 4', '13:00', 'Nome', '30a', 'PROCEDIMENTO', 'Cirurgia', 'OSCAR', 'SUS'),
    # seções: HEMO · EXAMES · IOSC (as 3 salas internas viram 'IOSC') · HO · MATERNO · CONSULT. · AMBULAT. · Centro de Coluna · SIMONE
    # ('HEMO', '13:00', '', '', 'ANGIOPLASTIA – 1H', 'Cirurgiao', 'RAFAEL', '', 'amarelo'),
    # ('IOSC', '13:30', 'Nome', '', 'PROCEDIMENTO', 'Cirurgiao', 'GABRIEL', 'PART'),
    # ('MATERNO', '15:30', '', '', '02 PROCEDIMENTOS', 'Shindy', 'RAFAEL', '', 'amarelo'),
    # ('CONSULT.', '13:30', '', '', 'CONSULTORIO', '', 'LEANDRO', ''),
]
hro = hospital(
    'hro', HRO, data=DATA,
    ordem=[],
    ajuda=[],
)

# ── MATERNO (Mapa de cirurgias HC — o dia inteiro; só o nome À MÃO em vermelho é anestesista) ──
MAT = [
    # linhas do turno SEM nome anotado → '?' explícito (nunca '' nem '//': herdariam o nome de baixo pela base da sala)
    # ('Sala 3 HC', '13:30', 'Nome Completo', '5', 'TURBINECTOMIA + ADENOIDECTOMIA', 'Patricia Rauber', '?', 'SUS'),
    # ('Sala 3 HC', '15:30', 'Nome Completo', '7', 'PROCEDIMENTO', 'Sindhy Mara Longo', 'RAFAEL', 'SUS'),
    # ('Sala 3 HC', '16:30', 'Nome Completo', '6', 'PROCEDIMENTO', 'Sindhy Mara Longo', '//', 'SUS'),
]
materno = hospital('materno', MAT, data=DATA)

lote = {
    'data': DATA,
    'turno': TURNO,
    'hospitais': {'unimed': unimed, 'hro': hro, 'materno': materno},
    # Recado "A na posição do B no HRO" → registro nos DOIS lados quando os dois estão em escala;
    # `local` = onde o PARCEIRO está (Unimed / HRO / Consultório). Sempre apenasRegistro.
    'decisoes': {
        # 'THAYNA': {'tipo': 'troca', 'parceiro': 'GIOVANA', 'apenasRegistro': True, 'local': 'Unimed'},
        # 'GIOVANA': {'tipo': 'troca', 'parceiro': 'THAYNA', 'apenasRegistro': True, 'local': 'HRO'},
        # 'DANIELA': {'tipo': 'troca', 'parceiro': 'CRISTINA', 'apenasRegistro': True, 'local': 'Consultório'},
        # linha MATERNO do HRO + mapa HC sem troca no recado → 'NOME': {'tipo': 'intencional'},
    },
    # quem fecha o rodapé SEM caso (plantão do contraturno / noite) — "está certo, fica Livre"
    'conferidos': [],
}

salvar(D, unimed, hro, materno, lote)
