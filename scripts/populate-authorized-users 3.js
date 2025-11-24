#!/usr/bin/env node
/**
 * Script para popular usuários autorizados no sistema ANEST
 * 
 * Este script:
 * 1. Adiciona emails autorizados à coleção authorized_emails
 * 2. Cria usuários no Firebase Authentication com senha padrão
 * 3. Cria perfis iniciais nas coleções users e userProfiles
 * 
 * USO:
 *   node populate-authorized-users.js
 * 
 * REQUISITOS:
 *   - npm install (para instalar firebase-admin)
 *   - Chave de serviço do Firebase no diretório pai: ../firebase-service-account.json
 *   - Ou variável de ambiente GOOGLE_APPLICATION_CREDENTIALS apontando para a chave
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ==================== CONFIGURAÇÃO ====================

// Lista de usuários autorizados (43 usuários)
const AUTHORIZED_USERS = [
    { name: 'ADRIANO DALL MAGRO', email: 'dallmagro@hotmail.com' },
    { name: 'ALEXANDRE SCHMIDT', email: 'alexandre.schmidt82@gmail.com' },
    { name: 'ALEXANDRE SILVA DANIELI', email: 'alexandre_danieli@yahoo.com.br' },
    { name: 'ALINE BOFF BONFANTE', email: 'alineanestesio@gmail.com' },
    { name: 'CRISTINA BERTOL BARBOSA MARCON', email: 'cristinabertolb@gmail.com' },
    { name: 'DIEGO BONIATTI RIGOTTI', email: 'diegobori@hotmail.com' },
    { name: 'EDUARDO SCHMIDT SAVOLDI', email: 'edusavoldi@gmail.com' },
    { name: 'ERLEI PERINI', email: 'erlei@clinicastelo.com.br' },
    { name: 'FERNANDA GUOLLO', email: 'guollofernanda@gmail.com' },
    { name: 'FERNANDO HENRIQUE MACHADO', email: 'fhm555@gmail.com' },
    { name: 'GABRIEL JUAN KETTENHUBER COSTA', email: 'gabrieljkc@gmail.com' },
    { name: 'GABRIELA CITRON VEDANA', email: 'gabicvedana@gmail.com' },
    { name: 'GIOVANA GOMES NOLL', email: 'giovanagomes.noll@gmail.com' },
    { name: 'GUILHERME JONCK STAUB', email: 'guigostaub@hotmail.com' },
    { name: 'GUILHERME SOUZA MELO', email: 'anestesistaguilherme@gmail.com' },
    { name: 'GUSTAVO ALMANSA GARIM', email: 'gustavogarim@hotmail.com' },
    { name: 'GUSTAVO BIESDORF', email: 'gustavoo_b@hotmail.com' },
    { name: 'HUMBERTO HEPP', email: 'eclampsium@yahoo.com.br' },
    { name: 'IARA GRASEL', email: 'iara.grasel@hotmail.com' },
    { name: 'JANAINA SANCHES FAVORITO MORAIS', email: 'janafavorito@gmail.com' },
    { name: 'JOÃO RICARDO MOREIRA', email: 'joaormoreiraster@gmail.com' },
    { name: 'KARINE BEDIN', email: 'karine.bedin9@gmail.com' },
    { name: 'KLISMAN DRESCHER HILLESHEIN', email: 'klismandrescherhilleshein@gmail.com' },
    { name: 'LEANDRO BERNARDES', email: 'leandrobernardes03@hotmail.com' },
    { name: 'LEONARDO FERRAZZO', email: 'leoferrazzo@gmail.com' },
    { name: 'LOUISE MACAGNAN WARNAVA', email: 'louisewarnava@yahoo.com.br' },
    { name: 'MARCOS CARDOSO COSTA', email: 'marcoscc1211@gmail.com' },
    { name: 'MARCOS TADEU CURY', email: 'mtcury19@gmail.com' },
    { name: 'MARILIO JOSE FLACH', email: 'mariliojosef@hotmail.com' },
    { name: 'MATHEUS LEMOS VIEIRA DA CUNHA', email: 'dormatheuscunha@gmail.com' },
    { name: 'MAURICIO MAHALEM BASTOS', email: 'dezembro71@hotmail.com' },
    { name: 'OSCAR OLIVEIRA DE MORAIS', email: 'oscarmorais@hotmail.com' },
    { name: 'PAULO TONINI', email: 'paulotmed@gmail.com' },
    { name: 'RAFAEL PELISSARO', email: 'rafaelpelissaro@gmail.com' },
    { name: 'RAQUEL SCHNEIDER FELICIANI', email: 'raquel_schneider_12@hotmail.com' },
    { name: 'RAUL PERIZZOLO', email: 'raperizzolo@gmail.com' },
    { name: 'ROBERTA MARINA GRANDO', email: 'robertagrando@yahoo.com.br' },
    { name: 'RODNEI LIMA CABRAL', email: 'rodneilima@gmail.com' },
    { name: 'ROSANGELA SILVA', email: 'rosangela_msilva1@outlook.com' },
    { name: 'ROSEMARY CURY', email: 'rosecury64@gmail.com' },
    { name: 'THAYNA REGINA SANTOS', email: 'thayna_santos9@hotmail.com' },
    { name: 'TIAGO IOP VIANA', email: 'tiagoiopviana@gmail.com' },
    { name: 'VICENTE ANTONIO ALVES PONS', email: 'vicentepons4@gmail.com' }
];

const DEFAULT_PASSWORD = '123456';

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
    console.error('\nPor favor, faça o download da chave de serviço do Firebase Console:');
    console.error('  1. Acesse: https://console.firebase.google.com/');
    console.error('  2. Selecione seu projeto');
    console.error('  3. Vá em Configurações do Projeto > Contas de Serviço');
    console.error('  4. Clique em "Gerar nova chave privada"');
    console.error('  5. Salve o arquivo como: firebase-service-account.json');
    console.error('  6. Coloque-o na raiz do projeto (diretório Qmentum/)');
    console.error('\nOu defina a variável de ambiente:');
    console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/firebase-service-account.json"');
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

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Adiciona email à coleção authorized_emails
 */
async function addAuthorizedEmail(email, name, addedBy = 'system') {
    try {
        const emailDoc = db.collection('authorized_emails').doc(email.toLowerCase());
        await emailDoc.set({
            email: email.toLowerCase(),
            name: name,
            addedAt: admin.firestore.FieldValue.serverTimestamp(),
            addedBy: addedBy,
            isActive: true
        });
        return true;
    } catch (error) {
        console.error(`  ❌ Erro ao adicionar email ${email}:`, error.message);
        return false;
    }
}

/**
 * Cria usuário no Firebase Authentication
 */
async function createAuthUser(email, password, displayName) {
    try {
        const userRecord = await auth.createUser({
            email: email.toLowerCase(),
            password: password,
            displayName: displayName,
            emailVerified: false
        });
        return userRecord;
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            // Usuário já existe, apenas retornar
            const existingUser = await auth.getUserByEmail(email.toLowerCase());
            return existingUser;
        }
        throw error;
    }
}

/**
 * Cria perfil do usuário no Firestore (coleção users)
 */
async function createUserProfile(uid, email, name) {
    try {
        await db.collection('users').doc(uid).set({
            name: name,
            email: email.toLowerCase(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            role: 'socio', // Role padrão
            progress: {},
            totalPoints: 0,
            cardPermissions: {},
            documentCategoryPermissions: {},
            documentIndividualPermissions: {},
            documentWritePermissions: {},
            customPermissions: {}
        }, { merge: true });
        return true;
    } catch (error) {
        console.error(`  ❌ Erro ao criar perfil users para ${email}:`, error.message);
        return false;
    }
}

/**
 * Cria perfil do usuário no Firestore (coleção userProfiles)
 */
async function createUserProfileDetail(uid, email, name) {
    try {
        const nameParts = name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await db.collection('userProfiles').doc(uid).set({
            firstName: firstName,
            lastName: lastName,
            email: email.toLowerCase(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            progress: {}
        }, { merge: true });
        return true;
    } catch (error) {
        console.error(`  ❌ Erro ao criar perfil userProfiles para ${email}:`, error.message);
        return false;
    }
}

// ==================== SCRIPT PRINCIPAL ====================

async function main() {
    console.log('========================================');
    console.log('  POPULAR USUÁRIOS AUTORIZADOS - ANEST');
    console.log('========================================\n');
    console.log(`Total de usuários a processar: ${AUTHORIZED_USERS.length}\n`);
    
    let stats = {
        emailsAdded: 0,
        emailsSkipped: 0,
        authCreated: 0,
        authSkipped: 0,
        profilesCreated: 0,
        errors: 0
    };
    
    for (let i = 0; i < AUTHORIZED_USERS.length; i++) {
        const user = AUTHORIZED_USERS[i];
        const progress = `[${i + 1}/${AUTHORIZED_USERS.length}]`;
        
        console.log(`${progress} Processando: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        
        // 1. Adicionar email autorizado
        const emailAdded = await addAuthorizedEmail(user.email, user.name);
        if (emailAdded) {
            console.log(`  ✓ Email autorizado adicionado`);
            stats.emailsAdded++;
        } else {
            stats.emailsSkipped++;
        }
        
        // 2. Criar usuário no Authentication
        try {
            const userRecord = await createAuthUser(user.email, DEFAULT_PASSWORD, user.name);
            console.log(`  ✓ Usuário criado no Authentication (UID: ${userRecord.uid})`);
            stats.authCreated++;
            
            // 3. Criar perfil no Firestore (users)
            const profileCreated = await createUserProfile(userRecord.uid, user.email, user.name);
            if (profileCreated) {
                console.log(`  ✓ Perfil criado (users)`);
                stats.profilesCreated++;
            }
            
            // 4. Criar perfil detalhado no Firestore (userProfiles)
            const profileDetailCreated = await createUserProfileDetail(userRecord.uid, user.email, user.name);
            if (profileDetailCreated) {
                console.log(`  ✓ Perfil detalhado criado (userProfiles)`);
            }
            
        } catch (error) {
            if (error.code === 'auth/email-already-exists') {
                console.log(`  ⊘ Usuário já existe no Authentication`);
                stats.authSkipped++;
            } else {
                console.error(`  ❌ Erro ao criar usuário:`, error.message);
                stats.errors++;
            }
        }
        
        console.log('');
    }
    
    // Resumo final
    console.log('========================================');
    console.log('  RESUMO DA EXECUÇÃO');
    console.log('========================================');
    console.log(`✓ Emails autorizados adicionados: ${stats.emailsAdded}`);
    console.log(`⊘ Emails já existentes: ${stats.emailsSkipped}`);
    console.log(`✓ Usuários criados (Auth): ${stats.authCreated}`);
    console.log(`⊘ Usuários já existentes (Auth): ${stats.authSkipped}`);
    console.log(`✓ Perfis criados (Firestore): ${stats.profilesCreated}`);
    console.log(`❌ Erros: ${stats.errors}`);
    console.log('========================================\n');
    
    console.log('✅ Script concluído com sucesso!');
    console.log(`\nSenha padrão para todos os usuários: ${DEFAULT_PASSWORD}`);
    console.log('Os usuários podem alterar a senha voluntariamente após o login.\n');
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







