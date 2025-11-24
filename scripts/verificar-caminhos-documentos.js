#!/usr/bin/env node

/**
 * Verifica se todos os caminhos de documentos no código existem fisicamente
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando caminhos de documentos...\n');

// 1. Ler search-index-complete.js
const searchIndexPath = path.join(__dirname, '../search-index-complete.js');
const searchIndexContent = fs.readFileSync(searchIndexPath, 'utf8');

// 2. Extrair todos os caminhos de arquivo usando regex
const arquivoMatches = searchIndexContent.matchAll(/arquivo:\s*'([^']+)'/g);
const caminhos = [];

for (const match of arquivoMatches) {
    caminhos.push(match[1]);
}

console.log(`📊 Total de caminhos encontrados: ${caminhos.length}\n`);

// 3. Verificar se cada arquivo existe
const appDir = path.join(__dirname, '..');
const erros = [];
const avisos = [];

caminhos.forEach((caminho, index) => {
    const caminhoCompleto = path.join(appDir, caminho);

    if (!fs.existsSync(caminhoCompleto)) {
        erros.push({
            numero: index + 1,
            caminho: caminho,
            completo: caminhoCompleto
        });
    } else {
        // Verificar se há acentos no nome do arquivo
        if (/[áàâãéèêíïóôõöúçñ]/i.test(caminho)) {
            avisos.push({
                numero: index + 1,
                caminho: caminho,
                motivo: 'Contém acentos (pode causar problemas no Firebase Storage)'
            });
        }
    }
});

// 4. Relatório
console.log('=' .repeat(80));
console.log('📋 RELATÓRIO DE VERIFICAÇÃO');
console.log('='.repeat(80));

if (erros.length === 0) {
    console.log('\n✅ TODOS OS ARQUIVOS EXISTEM!\n');
} else {
    console.log(`\n❌ ARQUIVOS NÃO ENCONTRADOS: ${erros.length}\n`);
    erros.forEach(erro => {
        console.log(`${erro.numero}. ❌ ${erro.caminho}`);
        console.log(`   Caminho completo: ${erro.completo}\n`);
    });
}

if (avisos.length > 0) {
    console.log('='.repeat(80));
    console.log(`\n⚠️  AVISOS (arquivos com acentos): ${avisos.length}\n`);
    avisos.forEach(aviso => {
        console.log(`${aviso.numero}. ⚠️  ${aviso.caminho}`);
        console.log(`   Motivo: ${aviso.motivo}\n`);
    });
}

console.log('='.repeat(80));
console.log(`\n📊 RESUMO:`);
console.log(`   ✅ Arquivos encontrados: ${caminhos.length - erros.length}`);
console.log(`   ❌ Arquivos NÃO encontrados: ${erros.length}`);
console.log(`   ⚠️  Arquivos com acentos: ${avisos.length}\n`);

// 5. Sugestões
if (erros.length > 0) {
    console.log('💡 SUGESTÕES:');
    console.log('   1. Verificar se os arquivos foram movidos ou renomeados');
    console.log('   2. Atualizar os caminhos em search-index-complete.js');
    console.log('   3. Fazer upload dos arquivos no Firebase Storage\n');
}

if (avisos.length > 0) {
    console.log('💡 RECOMENDAÇÃO:');
    console.log('   - Renomear arquivos removendo acentos para evitar problemas');
    console.log('   - Acentos podem causar erros 404 no Firebase Storage\n');
}

// 6. Exit code
process.exit(erros.length > 0 ? 1 : 0);
