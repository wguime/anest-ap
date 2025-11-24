#!/usr/bin/env node

/**
 * Script para testar as queries exatamente como o documento-manager.js faz
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

// Testar query exatamente como documento-manager.js
async function testarQuery(collection) {
    console.log(`\n🔍 Testando query para ${collection}...`);
    
    try {
        // Tentar com filtro de ativo + orderBy (como no código)
        const docs = await db.collection(collection)
            .where('ativo', '==', true)
            .orderBy('data', 'desc')
            .limit(50)
            .get();
        
        console.log(`   ✅ Query com filtro + orderBy: ${docs.size} documentos`);
        
        docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   ${idx + 1}. ${data.titulo}`);
            console.log(`      Data: ${data.data ? (data.data.toDate ? data.data.toDate().toLocaleDateString('pt-BR') : 'N/A') : 'N/A'}`);
        });
        
        return { sucesso: true, count: docs.size };
    } catch (error) {
        console.log(`   ❌ Erro com filtro + orderBy: ${error.message}`);
        
        // Tentar apenas com filtro
        try {
            const docs = await db.collection(collection)
                .where('ativo', '==', true)
                .limit(50)
                .get();
            
            console.log(`   ✅ Query apenas com filtro: ${docs.size} documentos`);
            
            docs.forEach((doc, idx) => {
                const data = doc.data();
                console.log(`   ${idx + 1}. ${data.titulo}`);
            });
            
            return { sucesso: true, count: docs.size, semOrderBy: true };
        } catch (error2) {
            console.log(`   ❌ Erro com apenas filtro: ${error2.message}`);
            
            // Tentar sem filtro
            try {
                const docs = await db.collection(collection)
                    .limit(50)
                    .get();
                
                console.log(`   ✅ Query sem filtro: ${docs.size} documentos`);
                
                return { sucesso: true, count: docs.size, semFiltro: true };
            } catch (error3) {
                console.log(`   ❌ Erro sem filtro: ${error3.message}`);
                return { sucesso: false, erro: error3.message };
            }
        }
    }
}

async function main() {
    console.log('🧪 Testando Queries de Documentos\n');
    console.log('='.repeat(80));
    
    const collections = ['doc_lista_abreviaturas', 'protocolo_institucional', 'biblioteca_documentos'];
    
    for (const collection of collections) {
        await testarQuery(collection);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 Se houver erros, pode ser necessário criar índices compostos');
    console.log('='.repeat(80));
    
    process.exit(0);
}

main().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});

