#!/usr/bin/env node
/**
 * Script para atualizar nomes completos dos usuários existentes
 * 
 * Este script atualiza o campo 'name' dos usuários no Firestore
 * e o displayName no Firebase Authentication
 * 
 * USO:
 *   node atualizar-nomes-usuarios.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ==================== MAPEAMENTO EMAIL → NOME ====================
const EMAIL_TO_NAME = {
    'dallmagro@hotmail.com': 'ADRIANO DALL MAGRO',
    'alexandre.schmidt82@gmail.com': 'ALEXANDRE SCHMIDT',
    'alexandre_danieli@yahoo.com.br': 'ALEXANDRE SILVA DANIELI',
    'alineanestesio@gmail.com': 'ALINE BOFF BONFANTE',
    'cristinabertolb@gmail.com': 'CRISTINA BERTOL BARBOSA MARCON',
    'diegobori@hotmail.com': 'DIEGO BONIATTI RIGOTTI',
    'edusavoldi@gmail.com': 'EDUARDO SCHMIDT SAVOLDI',
    'erlei@clinicastelo.com.br': 'ERLEI PERINI',
    'guollofernanda@gmail.com': 'FERNANDA GUOLLO',
    'fhm555@gmail.com': 'FERNANDO HENRIQUE MACHADO',
    'gabrieljkc@gmail.com': 'GABRIEL JUAN KETTENHUBER COSTA',
    'gabicvedana@gmail.com': 'GABRIELA CITRON VEDANA',
    'giovanagomes.noll@gmail.com': 'GIOVANA GOMES NOLL',
    'guigostaub@hotmail.com': 'GUILHERME JONCK STAUB',
    'anestesistaguilherme@gmail.com': 'GUILHERME SOUZA MELO',
    'gustavogarim@hotmail.com': 'GUSTAVO ALMANSA GARIM',
    'gustavoo_b@hotmail.com': 'GUSTAVO BIESDORF',
    'eclampsium@yahoo.com.br': 'HUMBERTO HEPP',
    'iara.grasel@hotmail.com': 'IARA GRASEL',
    'janafavorito@gmail.com': 'JANAINA SANCHES FAVORITO MORAIS',
    'joaormoreiraster@gmail.com': 'JOÃO RICARDO MOREIRA',
    'karine.bedin9@gmail.com': 'KARINE BEDIN',
    'klismandrescherhilleshein@gmail.com': 'KLISMAN DRESCHER HILLESHEIN',
    'leandrobernardes03@hotmail.com': 'LEANDRO BERNARDES',
    'leoferrazzo@gmail.com': 'LEONARDO FERRAZZO',
    'louisewarnava@yahoo.com.br': 'LOUISE MACAGNAN WARNAVA',
    'marcoscc1211@gmail.com': 'MARCOS CARDOSO COSTA',
    'mtcury19@gmail.com': 'MARCOS TADEU CURY',
    'mariliojosef@hotmail.com': 'MARILIO JOSE FLACH',
    'dormatheuscunha@gmail.com': 'MATHEUS LEMOS VIEIRA DA CUNHA',
    'dezembro71@hotmail.com': 'MAURICIO MAHALEM BASTOS',
    'oscarmorais@hotmail.com': 'OSCAR OLIVEIRA DE MORAIS',
    'paulotmed@gmail.com': 'PAULO TONINI',
    'rafaelpelissaro@gmail.com': 'RAFAEL PELISSARO',
    'raquel_schneider_12@hotmail.com': 'RAQUEL SCHNEIDER FELICIANI',
    'raperizzolo@gmail.com': 'RAUL PERIZZOLO',
    'robertagrando@yahoo.com.br': 'ROBERTA MARINA GRANDO',
    'rodneilima@gmail.com': 'RODNEI LIMA CABRAL',
    'rosangela_msilva1@outlook.com': 'ROSANGELA SILVA',
    'rosecury64@gmail.com': 'ROSEMARY CURY',
    'thayna_santos9@hotmail.com': 'THAYNA REGINA SANTOS',
    'tiagoiopviana@gmail.com': 'TIAGO IOP VIANA',
    'vicentepons4@gmail.com': 'VICENTE ANTONIO ALVES PONS'
};

// ==================== INICIALIZAÇÃO ====================

// Tentar encontrar a chave de serviço
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
    console.error('\nColoque o arquivo firebase-service-account.json na raiz do projeto');
    process.exit(1);
}

console.log(`\n✓ Usando chave de serviço: ${serviceAccountPath}\n`);

// Inicializar Firebase Admin
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
    console.log('  ATUALIZAR NOMES DOS USUÁRIOS');
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
        const email = userData.email?.toLowerCase();
        
        if (!email) {
            console.log(`[${count}/${totalUsers}] ⊘ Usuário ${userId} sem email, pulando...`);
            stats.skipped++;
            continue;
        }
        
        const fullName = EMAIL_TO_NAME[email];
        
        if (!fullName) {
            console.log(`[${count}/${totalUsers}] ⊘ Nome não encontrado para ${email}`);
            stats.skipped++;
            continue;
        }
        
        // Verificar se já tem o nome correto
        if (userData.name === fullName) {
            console.log(`[${count}/${totalUsers}] ⊘ ${email} já tem nome correto`);
            stats.skipped++;
            continue;
        }
        
        console.log(`[${count}/${totalUsers}] Atualizando ${email}...`);
        console.log(`  Nome: ${fullName}`);
        
        try {
            // Atualizar Firestore (users)
            await db.collection('users').doc(userId).update({
                name: fullName,
                displayName: fullName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`  ✓ Firestore atualizado`);
            
            // Atualizar Firebase Auth (displayName)
            try {
                await auth.updateUser(userId, {
                    displayName: fullName
                });
                console.log(`  ✓ Authentication atualizado`);
            } catch (authError) {
                console.log(`  ⚠ Auth não atualizado (usuário pode não ter feito login ainda)`);
            }
            
            // Atualizar userProfiles se existir
            const profileDoc = await db.collection('userProfiles').doc(userId).get();
            if (profileDoc.exists) {
                const nameParts = fullName.split(' ');
                await db.collection('userProfiles').doc(userId).update({
                    firstName: nameParts[0] || '',
                    lastName: nameParts.slice(1).join(' ') || ''
                });
                console.log(`  ✓ UserProfile atualizado`);
            }
            
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
    console.log('  RESUMO DA ATUALIZAÇÃO');
    console.log('========================================');
    console.log(`✓ Usuários atualizados: ${stats.updated}`);
    console.log(`⊘ Usuários pulados: ${stats.skipped}`);
    console.log(`❌ Erros: ${stats.errors}`);
    console.log('========================================\n');
    
    if (stats.updated > 0) {
        console.log('✅ Nomes atualizados com sucesso!');
        console.log('Recarregue a página no navegador para ver as mudanças.\n');
    } else {
        console.log('ℹ️ Nenhum usuário foi atualizado (todos já tinham nomes corretos).\n');
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








