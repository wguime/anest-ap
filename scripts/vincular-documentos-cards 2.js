#!/usr/bin/env node

/**
 * Script para vincular documentos específicos aos cards reconfigurados
 * 
 * Uso: node scripts/vincular-documentos-cards.js
 * 
 * Requer: Firebase Admin SDK configurado
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Configuração do Firebase Admin
let serviceAccount;
try {
    serviceAccount = require('../serviceAccountKey.json');
} catch (e) {
    console.error('❌ Erro: Arquivo serviceAccountKey.json não encontrado.');
    console.log('📝 Para usar este script, você precisa:');
    console.log('1. Ir ao Firebase Console > Project Settings > Service Accounts');
    console.log('2. Clicar em "Generate new private key"');
    console.log('3. Salvar o arquivo como serviceAccountKey.json na pasta App/');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'anest-ap.firebasestorage.app'
});

const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();

// Mapeamento dos documentos para suas coleções e pastas
const documentosParaVincular = [
    {
        arquivo: 'Documentos/2 - Politicas/PLI.ANEST.0001-00 Politica de gestao da qualidade.pdf',
        collection: 'politica_gestao_qualidade',
        storagePath: 'politica_gestao_qualidade',
        titulo: 'Política de Gestão da Qualidade',
        descricao: 'Política institucional de gestão da qualidade'
    },
    {
        arquivo: 'Documentos/2 - Politicas/PLI.ANEST.0007-00 Politica de disclosure.docx',
        collection: 'politica_disclosure',
        storagePath: 'politica_disclosure',
        titulo: 'Política de Disclosure',
        descricao: 'Política de comunicação de eventos adversos'
    },
    {
        arquivo: 'Documentos/7 - Ficha Tecnica Indicadores/DIVISAO INDICADORES.pdf',
        collection: 'relatorio_indicadores',
        storagePath: 'relatorio_indicadores',
        titulo: 'Indicadores de Qualidade',
        descricao: 'Divisão e análise de indicadores de qualidade'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.CCG.0020-00 Prevencao e manejo de intoxicacao por anestesicos locais.pdf',
        collection: 'doc_intoxicacao_anestesicos',
        storagePath: 'doc_intoxicacao_anestesicos',
        titulo: 'Intoxicação por Anestésicos Locais',
        descricao: 'Prevenção e manejo de intoxicação por anestésicos locais'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0094_00 Manejo glicemia.pdf',
        collection: 'doc_manejo_glicemia',
        storagePath: 'doc_manejo_glicemia',
        titulo: 'Manejo da Glicemia',
        descricao: 'Protocolo de controle glicêmico'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0007-16 Protocolo de prevencao da broncoaspiracao..pdf',
        collection: 'protocolo_prevencao_broncoaspiracao',
        storagePath: 'protocolo_prevencao_broncoaspiracao',
        titulo: 'Prevenção da Broncoaspiração',
        descricao: 'Protocolo de prevenção de aspiração pulmonar'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0009-04 Prevencao de Alergia ao latex(AG. Anest 15.02.24).pdf',
        collection: 'protocolo_prevencao_alergia_latex',
        storagePath: 'protocolo_prevencao_alergia_latex',
        titulo: 'Prevenção de Alergia ao Látex',
        descricao: 'Protocolo de prevenção de reações alérgicas ao látex'
    },
    // Documentos adicionais encontrados que podem ser vinculados
    {
        arquivo: 'Documentos/4 - Relatorios de Seguranca/RELATORIO DE SEGURANCA 3° TRIMESTRE 2024.pdf',
        collection: 'relatorio_trimestral',
        storagePath: 'relatorio_trimestral',
        titulo: 'Relatório de Segurança - 3° Trimestre 2024',
        descricao: 'Relatório trimestral de segurança do paciente'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PT 03 Higiene de Maos.pdf',
        collection: 'protocolo_higiene_maos',
        storagePath: 'protocolo_higiene_maos',
        titulo: 'Protocolo de Higiene das Mãos',
        descricao: 'Protocolo de higienização das mãos'
    },
    
    // ==================== DOCUMENTOS FALTANTES - APENAS OS QUE FAZEM SENTIDO ====================
    // Nota: Documentos que já existem em produção foram removidos para evitar duplicatas
    
    // Lista de Abreviaturas Perigosas - Abreviação de Jejum (faz sentido para esta collection)
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.NUT.0002-19 Abreviacao de jejum prolongado(AG. Anest 15.02.24).pdf',
        collection: 'doc_lista_abreviaturas',
        storagePath: 'doc_lista_abreviaturas',
        titulo: 'Abreviação de Jejum Prolongado',
        descricao: 'Protocolo de abreviação de jejum prolongado para procedimentos anestésicos'
    },
    
    // Protocolo Institucional - Avaliação Pré-Anestésica (faz sentido para protocolo institucional)
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.ANEST.0001-00 avaliacao pre anestesica.pdf',
        collection: 'protocolo_institucional',
        storagePath: 'protocolo_institucional',
        titulo: 'Avaliação Pré-Anestésica',
        descricao: 'Protocolo de avaliação pré-anestésica do paciente'
    },
    
    // Biblioteca de Documentos - Protocolos complementares que fazem sentido
    {
        arquivo: 'Documentos/1 - Protocolos/PT 02 Identificacao do cliente.pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Protocolo de Identificação do Cliente',
        descricao: 'Protocolo de identificação correta do paciente/cliente'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.ANEST.0002-00 Manejo da cefaleira pos puncao dural.pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Manejo da Cefaleia Pós-Punção Dural',
        descricao: 'Protocolo de manejo da cefaleia após punção dural'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.CCG.0011-01 Manutencao da normotermia.pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Manutenção da Normotermia',
        descricao: 'Protocolo de manutenção da temperatura corporal durante procedimentos'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.CCG.0018-00 Profilaxia tratamento e resgate de dor aguda pos operatoria na SRPA..pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Profilaxia, Tratamento e Resgate de Dor Aguda Pós-Operatória na SRPA',
        descricao: 'Protocolo de manejo da dor aguda no período pós-operatório'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.INSH.0008-12 Prevencao de Deterioracao Clinica no Adulto - MEWS.pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Prevenção de Deterioração Clínica no Adulto - MEWS',
        descricao: 'Protocolo de identificação precoce de deterioração clínica usando escala MEWS'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.RPA.0003-00 Recuperacao pos anestesica.pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Recuperação Pós-Anestésica',
        descricao: 'Protocolo de recuperação pós-anestésica do paciente'
    },
    {
        arquivo: 'Documentos/1 - Protocolos/PRO.RPA.0004-00 Prevencao de nausea e vomito no pos-operatorio.pdf',
        collection: 'biblioteca_documentos',
        storagePath: 'biblioteca_documentos',
        titulo: 'Prevenção de Náusea e Vômito no Pós-Operatório',
        descricao: 'Protocolo de prevenção e tratamento de náusea e vômito pós-operatório'
    }
];

async function verificarDuplicata(collection, titulo) {
    try {
        const snapshot = await db.collection(collection)
            .where('titulo', '==', titulo)
            .get();
        
        if (!snapshot.empty) {
            return snapshot.docs[0].id; // Retorna o ID do documento existente
        }
        return null;
    } catch (error) {
        console.warn(`   ⚠️  Erro ao verificar duplicata: ${error.message}`);
        return null;
    }
}

async function uploadDocumento(config) {
    const arquivoPath = path.join(__dirname, '..', config.arquivo);
    const fileName = path.basename(arquivoPath);
    
    console.log(`\n📄 Processando: ${fileName}`);
    console.log(`   Collection: ${config.collection}`);
    console.log(`   Storage Path: ${config.storagePath}`);
    
    // Verificar se arquivo existe
    if (!fs.existsSync(arquivoPath)) {
        console.error(`   ❌ Arquivo não encontrado: ${arquivoPath}`);
        return { success: false, fileName, error: 'Arquivo não encontrado' };
    }
    
    try {
        // Verificar duplicata
        const docIdExistente = await verificarDuplicata(config.collection, config.titulo);
        if (docIdExistente) {
            console.log(`   ⚠️  Documento já existe (ID: ${docIdExistente}). Deseja substituir?`);
            console.log(`   ℹ️  Para substituir, exclua o documento existente manualmente primeiro.`);
            return { success: false, fileName, error: 'Documento já existe', docId: docIdExistente };
        }
        
        // Ler arquivo
        const fileBuffer = fs.readFileSync(arquivoPath);
        const fileStats = fs.statSync(arquivoPath);
        
        // Limpar nome do arquivo para evitar problemas
        const nomeLimpo = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Upload para Storage
        const timestamp = Date.now();
        const storageFileName = `${timestamp}_${nomeLimpo}`;
        const storagePath = `${config.storagePath}/${storageFileName}`;
        const file = bucket.file(storagePath);
        
        console.log(`   📤 Fazendo upload para Storage...`);
        await file.save(fileBuffer, {
            metadata: {
                contentType: mime.lookup(arquivoPath) || 'application/pdf',
            },
        });
        
        // Tornar arquivo público
        await file.makePublic();
        
        // Obter URL pública
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        console.log(`   ✅ Upload concluído`);
        
        // Criar documento no Firestore
        const docData = {
            titulo: config.titulo,
            descricao: config.descricao,
            autor: 'sistema@importacao',
            autorNome: 'Sistema de Importação',
            data: admin.firestore.FieldValue.serverTimestamp(),
            ativo: true,
            arquivoURL: downloadURL,
            arquivoNome: fileName
        };
        
        await db.collection(config.collection).add(docData);
        console.log(`   ✅ Documento adicionado ao Firestore`);
        
        return { success: true, fileName };
        
    } catch (error) {
        console.error(`   ❌ Erro ao processar ${fileName}:`, error.message);
        return { success: false, fileName, error: error.message };
    }
}

async function main() {
    console.log('🚀 Iniciando vinculação de documentos aos cards...\n');
    console.log(`📋 Total de documentos: ${documentosParaVincular.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const results = [];
    
    // Processar cada documento
    for (let i = 0; i < documentosParaVincular.length; i++) {
        const config = documentosParaVincular[i];
        console.log(`\n[${i + 1}/${documentosParaVincular.length}]`);
        
        const result = await uploadDocumento(config);
        results.push(result);
        
        if (result.success) {
            successCount++;
        } else {
            if (result.error === 'Documento já existe') {
                skippedCount++;
            } else {
                errorCount++;
            }
        }
        
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA VINCULAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Vinculados com sucesso: ${successCount}`);
    console.log(`⏭️  Pulados (já existem): ${skippedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📄 Total processado: ${documentosParaVincular.length}`);
    console.log('='.repeat(60));
    
    if (errorCount > 0) {
        console.log('\n⚠️ Documentos com erro:');
        results.filter(r => !r.success && r.error !== 'Documento já existe').forEach(r => {
            console.log(`   - ${r.fileName}: ${r.error}`);
        });
    }
    
    if (skippedCount > 0) {
        console.log('\nℹ️ Documentos que já existem (não foram substituídos):');
        results.filter(r => r.error === 'Documento já existe').forEach(r => {
            console.log(`   - ${r.fileName} (ID: ${r.docId})`);
        });
    }
    
    process.exit(errorCount > 0 ? 1 : 0);
}

// Executar
main().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});

