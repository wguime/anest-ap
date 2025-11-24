#!/usr/bin/env node

/**
 * Script para testar o carregamento de documentos exatamente como o código faz
 */

const admin = require('firebase-admin');

let serviceAccount;
try {
    serviceAccount = require('../serviceAccountKey.json');
} catch (e) {
    console.error('❌ Erro: Arquivo serviceAccountKey.json não encontrado.');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'anest-ap.firebasestorage.app'
});

const db = admin.firestore();

// Simular exatamente o que documento-manager.js faz
async function testarCarregamento(collection) {
    console.log(`\n🔍 Testando carregamento para ${collection}...`);
    
    let docs;
    let metodoUsado = '';
    
    try {
        // Nível 1: Tentar com filtro + orderBy
        docs = await db.collection(collection)
            .where('ativo', '==', true)
            .orderBy('data', 'desc')
            .limit(50)
            .get();
        metodoUsado = 'Filtro + OrderBy';
    } catch (orderError) {
        console.log(`   ⚠️  Nível 1 falhou: ${orderError.message.substring(0, 100)}`);
        try {
            // Nível 2: Apenas filtro
            docs = await db.collection(collection)
                .where('ativo', '==', true)
                .limit(50)
                .get();
            metodoUsado = 'Apenas Filtro';
        } catch (filterError) {
            console.log(`   ⚠️  Nível 2 falhou: ${filterError.message.substring(0, 100)}`);
            // Nível 3: Sem filtro
            docs = await db.collection(collection)
                .limit(50)
                .get();
            metodoUsado = 'Sem Filtro';
        }
    }
    
    console.log(`   ✅ Método usado: ${metodoUsado}`);
    console.log(`   📊 Documentos encontrados: ${docs.size}`);
    
    if (docs.empty) {
        console.log(`   ❌ Nenhum documento encontrado!`);
        return { collection, count: 0, metodoUsado };
    }
    
    // Simular processamento do código
    const docsArray = [];
    docs.forEach(doc => {
        const data = doc.data();
        // Filtrar apenas documentos ativos (fallback)
        if (data.ativo === false) return;
        docsArray.push({ id: doc.id, data: data });
    });
    
    // Ordenar por data
    docsArray.sort((a, b) => {
        const dataA = a.data.data?.toDate?.() || new Date(0);
        const dataB = b.data.data?.toDate?.() || new Date(0);
        return dataB - dataA;
    });
    
    console.log(`   ✅ Documentos processados: ${docsArray.length}`);
    console.log(`   📄 Documentos:`);
    docsArray.forEach((doc, idx) => {
        const data = doc.data;
        console.log(`      ${idx + 1}. ${data.titulo}`);
        console.log(`         Ativo: ${data.ativo}`);
        console.log(`         Data: ${data.data ? (data.data.toDate ? data.data.toDate().toLocaleDateString('pt-BR') : 'N/A') : 'N/A'}`);
    });
    
    return { collection, count: docsArray.length, metodoUsado, documentos: docsArray };
}

async function main() {
    console.log('🧪 Teste de Carregamento de Documentos\n');
    console.log('='.repeat(80));
    
    const collections = [
        'doc_lista_abreviaturas',
        'protocolo_institucional',
        'biblioteca_documentos'
    ];
    
    const resultados = [];
    
    for (const collection of collections) {
        const resultado = await testarCarregamento(collection);
        resultados.push(resultado);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO');
    console.log('='.repeat(80));
    
    resultados.forEach(r => {
        console.log(`\n${r.collection}:`);
        console.log(`   Método: ${r.metodoUsado}`);
        console.log(`   Documentos: ${r.count}`);
        if (r.count === 0) {
            console.log(`   ⚠️  PROBLEMA: Nenhum documento encontrado!`);
        }
    });
    
    const totalDocumentos = resultados.reduce((sum, r) => sum + r.count, 0);
    console.log(`\n📊 Total de documentos encontrados: ${totalDocumentos}`);
    
    if (totalDocumentos === 0) {
        console.log('\n❌ PROBLEMA CRÍTICO: Nenhum documento está sendo encontrado!');
        console.log('   Verifique:');
        console.log('   1. Se os documentos realmente foram adicionados');
        console.log('   2. Se o campo "ativo" está como true');
        console.log('   3. Se há problemas com as regras do Firestore');
    } else {
        console.log('\n✅ Documentos estão sendo encontrados corretamente!');
        console.log('   Se não aparecem na interface, pode ser problema de:');
        console.log('   - Cache do navegador');
        console.log('   - Código JavaScript não atualizado');
        console.log('   - Erro na renderização');
    }
    
    process.exit(0);
}

main().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});

