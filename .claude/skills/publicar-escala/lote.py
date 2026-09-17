"""
Helpers do gerar.py da skill /publicar-escala — o gerar.py de cada turno é SÓ dados.

    import sys; sys.path.insert(0, '.claude/skills/publicar-escala')
    from lote import montar, salvar

`montar(linhas)` recebe tuplas (sala, hora, paciente, idade, procedimento, cirurgiao, anestesista,
convenio[, cor[, tempo[, cont]]]) e devolve os casos na forma que `publicar` espera: `ordem` reinicia
por sala, iniciais saem do nome por regra, `pacienteNome` entra só em PARTICULAR/PART (é o que abre
a cobrança), `"?"`/vazio vira `semAnestesista`. `salvar(pasta, unimed, hro, materno, lote)` grava os
quatro JSONs e imprime o resumo dos casos especiais (particular, "?", cor, continuação) para a
releitura contra a foto.
"""
import json
import os
from unicodedata import normalize

PARTICULAS = {'DE', 'DA', 'DO', 'DAS', 'DOS', 'E'}


def up(s):
    return normalize('NFD', s).encode('ascii', 'ignore').decode().upper()


def iniciais(nome):
    toks = [t for t in nome.split() if up(t) not in PARTICULAS]
    letras = [up(t)[0] for t in toks][:4]
    return '.'.join(letras) + '.' if letras else ''


def particular(conv):
    return up(conv).strip() in ('PART', 'PARTICULAR')


def caso(sala, ordem, hora, paciente, idade, proc, cir, anest, conv, cor='', tempo='', cont=False):
    c = {
        'sala': sala, 'ordem': ordem, 'hora': hora, 'tempoEstimado': tempo,
        'pacienteIniciais': iniciais(paciente) if paciente else '',
    }
    if paciente and particular(conv):
        c['pacienteNome'] = paciente
    c.update({
        'idade': idade, 'procedimento': proc, 'convenio': conv, 'cirurgiao': cir,
        'anestesista': anest if anest else '?', 'bloco': 'normal', 'isContinuacao': cont,
        'semAnestesista': anest in ('?', ''), 'tipo': 'eletiva', 'cor': cor,
    })
    return c


def montar(linhas):
    out, ordem, ultima = [], 0, None
    for l in linhas:
        sala = l[0]
        ordem = ordem + 1 if sala == ultima else 0
        ultima = sala
        out.append(caso(sala, ordem, *l[1:]))
    return out


def hospital(nome, linhas, ordem=(), ajuda=(), posicoes=(), data='', ajuda_ordem_informada=False):
    h = {
        'hospital': nome,
        'casos': montar(linhas),
        'posicoesAssistenciais': [{'local': l, 'anestesista': a} for l, a in posicoes],
        'ordemLiberacao': list(ordem),
        'ajudaExterna': list(ajuda),
        'dataDetectada': data,
    }
    if ajuda_ordem_informada:
        h['ajudaOrdemInformada'] = True
    return h


def salvar(pasta, unimed, hro, materno, lote):
    for nome, obj in (('unimed.json', unimed), ('hro.json', hro), ('materno.json', materno), ('lote.json', lote)):
        with open(os.path.join(pasta, nome), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
    print('unimed', len(unimed['casos']), '| hro', len(hro['casos']), '| materno', len(materno['casos']))
    for h in (unimed, hro, materno):
        for c in h['casos']:
            if c.get('pacienteNome') or c['semAnestesista'] or c['cor'] or c['isContinuacao']:
                print(' ', h['hospital'], '|', c['sala'], c['hora'], '|', c['pacienteIniciais'], c.get('pacienteNome', ''),
                      '|', c['convenio'], '|', c['anestesista'], c['cor'],
                      'CONT' if c['isContinuacao'] else '', 'SEM' if c['semAnestesista'] else '')
