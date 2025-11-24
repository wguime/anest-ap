#!/usr/bin/env node

/**
 * Script para fazer upload dos documentos dos Comitês para o Firebase Storage
 *
 * Uso:
 *   node upload-comites.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'anest-ap.appspot.com'
});

const bucket = admin.storage().bucket();

// Lista dos 9 documentos dos Comitês
const documentos = [
    {
        local: 'REG.ANEST.0001-01 REGIMENTO INTERNO.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0001-01 REGIMENTO INTERNO.pdf',
        titulo: 'Regimento Interno'
    },
    {
        local: 'REG.ANEST.0002-00 REGIMENTO INTERNO DO COMITÊ FINANCEIRO.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0002-00 REGIMENTO INTERNO DO COMITÊ FINANCEIRO.pdf',
        titulo: 'Comitê Financeiro'
    },
    {
        local: 'REG.ANEST.0003-00 REGIMENTO INTERNO DO COMITÊ DE GESTÃO DE PESSOAS.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0003-00 REGIMENTO INTERNO DO COMITÊ DE GESTÃO DE PESSOAS.pdf',
        titulo: 'Comitê de Gestão de Pessoas'
    },
    {
        local: 'REG.ANEST.0004-00 REGIMENTO INTERNO DO COMITÊ DE QUALIDADE.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0004-00 REGIMENTO INTERNO DO COMITÊ DE QUALIDADE.pdf',
        titulo: 'Comitê de Qualidade'
    },
    {
        local: 'REG.ANEST.0005-00 REGIMENTO INTERNO DO COMITÊ DE EDUCAÇÃO CONTINUADA E DE RESIDÊNCIA MÉDICA (REVISADO).pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0005-00 REGIMENTO INTERNO DO COMITÊ DE EDUCAÇÃO CONTINUADA E DE RESIDÊNCIA MÉDICA (REVISADO).pdf',
        titulo: 'Comitê de Educação Continuada e Residência Médica'
    },
    {
        local: 'REG.ANEST.0006-00 REGIMENTO INTERNO DO COMITÊ DE ESCALAS.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0006-00 REGIMENTO INTERNO DO COMITÊ DE ESCALAS.pdf',
        titulo: 'Comitê de Escalas'
    },
    {
        local: 'REG.ANEST.0007-00 REGIMENTO INTERNO DO COMITÊ DE TECNOLOGIA E MATERIAIS.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0007-00 REGIMENTO INTERNO DO COMITÊ DE TECNOLOGIA E MATERIAIS.pdf',
        titulo: 'Comitê de Tecnologia e Materiais'
    },
    {
        local: 'REG.ANEST.0008-00 REGIMENTO INTERNO DO COMITÊ DE ÉTICA E CONDUTA.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0008-00 REGIMENTO INTERNO DO COMITÊ DE ÉTICA E CONDUTA.pdf',
        titulo: 'Comitê de Ética e Conduta'
    },
    {
        local: 'REG.ANEST.0009-00 REGIMENTO INTERNO DO COMITÊ EXECUTIVO DE GESTÃO.pdf',
        storage: 'Documentos/12 - Comitês /REG.ANEST.0009-00 REGIMENTO INTERNO DO COMITÊ EXECUTIVO DE GESTÃO.pdf',
        titulo: 'Comitê Executivo de Gestão'
    }
];

// Caminho base dos documentos locais
const BASE_PATH = path.join(__dirname, '..', 'Documentos', '12 - Comitês ');

async function uploadDocumento(doc) {
    const localPath = path.join(BASE_PATH, doc.local);

    // Verificar se o arquivo existe
    if (!fs.existsSync(localPath)) {
        console.error(`❌ Arquivo não encontrado: ${localPath}`);
        return false;
    }

    try {
        console.log(`📤 Uploading: ${doc.titulo}`);
        console.log(`   Local: ${doc.local}`);
        console.log(`   Storage: ${doc.storage}`);

        // Fazer upload para o Firebase Storage
        await bucket.upload(localPath, {
            destination: doc.storage,
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    firebaseStorageDownloadTokens: require('crypto').randomBytes(16).toString('hex')
                }
            }
        });

        console.log(`✅ Upload concluído: ${doc.titulo}\n`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao fazer upload de ${doc.titulo}:`, error.message);
        return false;
    }
}

async function uploadTodos() {
    console.log('🏛️  UPLOAD DE DOCUMENTOS DOS COMITÊS\n');
    console.log(`📁 Pasta local: ${BASE_PATH}`);
    console.log(`☁️  Firebase Storage: gs://anest-ap.appspot.com\n`);
    console.log(`📊 Total de documentos: ${documentos.length}\n`);
    console.log('═'.repeat(60) + '\n');

    let sucessos = 0;
    let erros = 0;

    for (const doc of documentos) {
        const resultado = await uploadDocumento(doc);
        if (resultado) {
            sucessos++;
        } else {
            erros++;
        }
    }

    console.log('═'.repeat(60));
    console.log('\n📈 RESUMO DO UPLOAD:');
    console.log(`   ✅ Sucessos: ${sucessos}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   📊 Total: ${documentos.length}\n`);

    if (erros === 0) {
        console.log('🎉 Todos os documentos foram enviados com sucesso!');
    } else {
        console.log('⚠️  Alguns documentos falharam. Verifique os erros acima.');
    }

    process.exit(erros > 0 ? 1 : 0);
}

// Executar upload
uploadTodos().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
