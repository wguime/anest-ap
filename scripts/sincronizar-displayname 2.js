#!/usr/bin/env node
/**
 * Script para sincronizar displayName no Firebase Authentication
 * baseado nos nomes completos salvos no Firestore
 * 
 * USO:
 *   node sincronizar-displayname.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ==================== INICIALIZAÇÃO ====================

let serviceAccountPath;
const possiblePaths = [
    path.join(__dirname, '..', '..', 'firebase-service-account.json'),
    path.join(__dirname, '..', 'firebase-service-account.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS
];

for (const possiblePath of possiblePaths) {
    if (possiblePath && fs.existsSync(possiblePath)) {
        serviceAccountPath = possiblePath;
        break;
    }
}

if (!serviceAccountPath) {
    console.error('\n❌ ERRO: Chave de serviço do Firebase não encontrada!');
    process.exit(1);
}

console.log(`\n✓ Usando chave de serviço: ${serviceAccountPath}\n`);

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✓ Firebase Admin inicializado com sucesso\n');
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
    process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// ==================== SCRIPT PRINCIPAL ====================

async function main() {
    console.log('========================================');
    console.log('  SINCRONIZAR DISPLAYNAME');
    console.log('========================================\n');
    
    let stats = {
        updated: 0,
        skipped: 0,
        errors: 0
    };
    
    // Buscar todos os usuários do Firestore
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    console.log(`Total de usuários encontrados: ${totalUsers}\n`);
    
    let count = 0;
    for (const doc of usersSnapshot.docs) {
        count++;
        const userId = doc.id;
        const userData = doc.data();
        const name = userData.name || userData.displayName;
        
        if (!name) {
            console.log(`[${count}/${totalUsers}] ⊘ Usuário ${userId} sem nome, pulando...`);
            stats.skipped++;
            continue;
        }
        
        console.log(`[${count}/${totalUsers}] Sincronizando ${userData.email || userId}...`);
        console.log(`  Nome: ${name}`);
        
        try {
            // Atualizar Firebase Auth displayName
            await auth.updateUser(userId, {
                displayName: name
            });
            console.log(`  ✓ DisplayName sincronizado no Authentication`);
            
            // Garantir que está no Firestore também
            await db.collection('users').doc(userId).update({
                displayName: name,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`  ✓ DisplayName sincronizado no Firestore`);
            
            stats.updated++;
            console.log('');
            
        } catch (error) {
            console.error(`  ❌ Erro: ${error.message}`);
            stats.errors++;
            console.log('');
        }
    }
    
    // Resumo final
    console.log('========================================');
    console.log('  RESUMO DA SINCRONIZAÇÃO');
    console.log('========================================');
    console.log(`✓ Usuários sincronizados: ${stats.updated}`);
    console.log(`⊘ Usuários pulados: ${stats.skipped}`);
    console.log(`❌ Erros: ${stats.errors}`);
    console.log('========================================\n');
    
    if (stats.updated > 0) {
        console.log('✅ DisplayNames sincronizados com sucesso!');
        console.log('Recarregue a página no navegador para ver as mudanças.\n');
    }
}

// Executar script
main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Erro fatal:', error);
        process.exit(1);
    });








