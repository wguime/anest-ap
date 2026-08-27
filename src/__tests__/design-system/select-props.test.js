// Trava: prop desconhecida na `Select` do DS é FALHA SILENCIOSA.
//
// A `Select` desestrutura as props que entende e joga o resto no container com
// `{...props}` (ui/select.jsx:332). Uma prop errada não quebra o build, não
// lança, não some da tela — ela vira atributo de `<div>`. O React só resmunga
// no console ("Unknown event handler property") e a tela CONTINUA PARECENDO
// FUNCIONAR: o dropdown abre, as opções aparecem, o clique fecha. Só o valor
// nunca chega ao estado.
//
// Caso real (26/08/2026): `Saps3Display` passava `onValueChange` em 15 lugares.
// A SAPS III — escore de mortalidade em UTI — não gravava NENHUMA seleção, e
// nada na suíte acusou. Este teste é a trava que faltava.
//
// A allowlist NÃO é escrita à mão: é extraída da própria assinatura da `Select`.
// Renomear uma prop no componente atualiza a regra sozinho, sem deixar a trava
// aprovando o que o componente não aceita mais.

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');
const SELECT_FILE = path.join(SRC, 'design-system/components/ui/select.jsx');

// Caminhos de import que entregam a `Select` do DS. O barrel `@/design-system`
// reexporta `components/ui/select` via `export * from './components'`.
//
// ⚠️ Reconhecer só o alias NÃO basta: os displays das calculadoras — inclusive a
// `Saps3Display`, o caso que originou esta trava — importam por caminho
// RELATIVO (`../../components/ui/select`). Uma allowlist só de alias deixaria
// passar exatamente o bug que este teste existe para pegar.
const DS_ALIASES = new Set([
  '@/design-system',
  '@/design-system/components',
  '@/design-system/components/ui/select',
]);

// Módulos que reexportam a `Select`, como caminho absoluto sem extensão.
const dsModuleTargets = (root) =>
  [
    'design-system/components/ui/select',
    'design-system/components',
    'design-system/components/index',
    'design-system',
    'design-system/index',
  ].map((rel) => path.join(root, rel));

/** O import `source`, feito de dentro de `file`, entrega a `Select` do DS? */
function isDsSelectSource(source, file, root) {
  if (DS_ALIASES.has(source)) return true;
  if (!source.startsWith('.')) return false;
  const resolved = path.resolve(path.dirname(file), source).replace(/\.jsx?$/, '');
  return dsModuleTargets(root).includes(resolved);
}

// Props que a `Select` não desestrutura mas cujo destino (o `<div>` container)
// é legítimo: atributos de dado/acessibilidade e os especiais do React.
const PASSTHROUGH = new Set(['key', 'ref', 'style']);
const isPassthrough = (name) => PASSTHROUGH.has(name) || /^(data-|aria-)/.test(name);

const parseJsx = (code) =>
  parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });

/** Percorre a AST chamando `visit` em todo nó. */
function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) value.forEach((v) => walkAst(v, visit));
    else if (value && typeof value === 'object' && value.type) walkAst(value, visit);
  }
}

/** Lista todo .js/.jsx sob `dir`, ignorando os próprios testes. */
function listSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      listSourceFiles(full, out);
    } else if (/\.jsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** As props que a `Select` realmente desestrutura, lidas da assinatura dela. */
export function readAcceptedProps(selectFile = SELECT_FILE) {
  const ast = parseJsx(fs.readFileSync(selectFile, 'utf8'));
  let props = null;
  walkAst(ast.program, (node) => {
    if (props) return;
    if (node.type !== 'VariableDeclarator' || node.id?.name !== 'Select') return;
    // `React.forwardRef(fn)` — a assinatura está no 1º argumento.
    const fn = node.init?.arguments?.[0] ?? node.init;
    const first = fn?.params?.[0];
    if (first?.type === 'ObjectPattern') {
      props = first.properties
        .filter((p) => p.type === 'ObjectProperty')
        .map((p) => p.key.name);
    }
  });
  return props;
}

// `root` é parâmetro para a trava poder ser conferida contra o código ANTIGO:
// aponta-se para um espelho com a versão pré-correção e verifica-se que ela
// acusa. Trava que passa nos dois lados não protege nada.
/** Toda prop passada a `<Select>` sob `root`, com arquivo:linha. */
export function collectSelectProps(root = SRC) {
  const found = [];
  for (const file of listSourceFiles(root)) {
    const code = fs.readFileSync(file, 'utf8');
    if (!code.includes('Select')) continue;

    const ast = parseJsx(code);

    // Nome local da `Select` do DS neste arquivo (pode vir com alias).
    const locals = new Set();
    for (const node of ast.program.body) {
      if (node.type !== 'ImportDeclaration') continue;
      if (!isDsSelectSource(node.source.value, file, root)) continue;
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier' && spec.imported.name === 'Select') {
          locals.add(spec.local.name);
        }
      }
    }
    if (locals.size === 0) continue;

    walkAst(ast.program, (node) => {
      if (node.type !== 'JSXOpeningElement') return;
      if (node.name?.type !== 'JSXIdentifier' || !locals.has(node.name.name)) return;
      for (const attr of node.attributes) {
        if (attr.type === 'JSXSpreadAttribute') continue; // spread não dá para checar estaticamente
        found.push({
          prop: attr.name.name,
          where: `${path.relative(root, file)}:${attr.loc.start.line}`,
        });
      }
    });
  }
  return found;
}

describe('Select do DS — nenhuma prop desconhecida', () => {
  const accepted = readAcceptedProps();

  it('a assinatura da Select é legível (a allowlist não pode ser inventada)', () => {
    expect(accepted).toBeTruthy();
    // Se isto quebrar, a `Select` mudou de forma e a trava virou decoração:
    // conserte a extração antes de mexer em qualquer outra coisa.
    expect(accepted).toEqual(expect.arrayContaining(['options', 'value', 'onChange']));
  });

  it('nenhum consumidor passa prop que a Select não entende', () => {
    const offenders = collectSelectProps().filter(
      ({ prop }) => !accepted.includes(prop) && !isPassthrough(prop)
    );

    const report = offenders
      .map(({ prop, where }) => `  ${where} → \`${prop}\``)
      .join('\n');

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `A \`Select\` do DS aceita: ${accepted.join(', ')}.\n` +
            'As props abaixo caem no `{...props}` e viram atributo de <div> — ' +
            'a tela parece funcionar e o valor nunca chega ao estado:\n' +
            report
    ).toEqual([]);
  });
});
