#!/usr/bin/env node

/**
 * Script para verificar detalhadamente documentos específicos no Firestore
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

// Collections que devem ter recebido novos documentos
const collectionsParaVerificar = [
    'doc_lista_abreviaturas',
    'protocolo_institucional',
    'biblioteca_documentos'
];

async function verificarCollectionDetalhado(nomeColecao) {
    try {
        console.log(`\n🔍 Verificando ${nomeColecao}...`);
        
        // Buscar TODOS os documentos (sem filtro)
        const snapshotTodos = await db.collection(nomeColecao).get();
        console.log(`   Total de documentos (sem filtro): ${snapshotTodos.size}`);
        
        // Buscar apenas documentos ativos
        const snapshotAtivos = await db.collection(nomeColecao)
            .where('ativo', '==', true)
            .get();
        console.log(`   Documentos com ativo=true: ${snapshotAtivos.size}`);
        
        // Buscar documentos sem campo ativo
        const docsSemAtivo = [];
        snapshotTodos.forEach(doc => {
            const data = doc.data();
            if (data.ativo === undefined) {
                docsSemAtivo.push({ id: doc.id, titulo: data.titulo || 'Sem título' });
            }
        });
        
        if (docsSemAtivo.length > 0) {
            console.log(`   ⚠️  Documentos sem campo 'ativo': ${docsSemAtivo.length}`);
            docsSemAtivo.forEach(doc => {
                console.log(`      - ${doc.titulo} (ID: ${doc.id})`);
            });
        }
        
        // Listar todos os documentos
        console.log(`\n   📄 Documentos encontrados:`);
        snapshotTodos.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   ${idx + 1}. ${data.titulo || 'Sem título'}`);
            console.log(`      ID: ${doc.id}`);
            console.log(`      Ativo: ${data.ativo !== undefined ? data.ativo : 'NÃO DEFINIDO'}`);
            console.log(`      Data: ${data.data ? (data.data.toDate ? data.data.toDate().toLocaleDateString('pt-BR') : 'N/A') : 'N/A'}`);
            console.log(`      Arquivo: ${data.arquivoNome || data.arquivoURL ? 'Sim' : 'Não'}`);
            console.log('');
        });
        
        return {
            colecao: nomeColecao,
            total: snapshotTodos.size,
            ativos: snapshotAtivos.size,
            semAtivo: docsSemAtivo.length
        };
    } catch (error) {
        console.error(`   ❌ Erro: ${error.message}`);
        return {
            colecao: nomeColecao,
            total: 0,
            ativos: 0,
            semAtivo: 0,
            erro: error.message
        };
    }
}

async function main() {
    console.log('🔍 Verificação Detalhada de Documentos\n');
    console.log('='.repeat(80));
    
    const resultados = [];
    
    for (const nomeColecao of collectionsParaVerificar) {
        const resultado = await verificarCollectionDetalhado(nomeColecao);
        resultados.push(resultado);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO');
    console.log('='.repeat(80));
    
    resultados.forEach(r => {
        console.log(`\n${r.colecao}:`);
        console.log(`   Total: ${r.total}`);
        console.log(`   Ativos: ${r.ativos}`);
        if (r.semAtivo > 0) {
            console.log(`   ⚠️  Sem campo 'ativo': ${r.semAtivo}`);
        }
    });
    
    // Verificar se há documentos sem campo 'ativo'
    const totalSemAtivo = resultados.reduce((sum, r) => sum + (r.semAtivo || 0), 0);
    if (totalSemAtivo > 0) {
        console.log('\n⚠️  PROBLEMA ENCONTRADO:');
        console.log(`   ${totalSemAtivo} documento(s) sem campo 'ativo'`);
        console.log('   Estes documentos não aparecerão na interface web!');
        console.log('\n💡 SOLUÇÃO:');
        console.log('   Atualizar documentos para incluir campo ativo: true');
    }
    
    process.exit(0);
}

main().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});

