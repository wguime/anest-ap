#!/usr/bin/env node

/**
 * Script para importar todos os documentos da pasta Documentos para a biblioteca_documentos
 * 
 * Uso: node scripts/importar-documentos.js
 * 
 * Requer: Firebase Admin SDK configurado
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Configuração do Firebase Admin
// NOTA: Você precisa configurar as credenciais do Firebase Admin
// Crie um arquivo serviceAccountKey.json com as credenciais do Firebase

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

// Função para extrair nome da pasta sem números
function getCategoryNameFromFolder(folderName) {
    // Remove número e " - " do início se existir (ex: "1 - Protocolos" -> "Protocolos")
    const match = folderName.match(/^\d+\s*-\s*(.+)$/);
    if (match) {
        return match[1].trim();
    }
    return folderName.trim();
}

// Mapeamento de pastas para categorias (usando nomes exatos das pastas, sem números)
const categoryMap = {
    '1 - Protocolos': 'Protocolos',
    '2 - Politicas': 'Politicas',
    '3 - Formularios': 'Formularios',
    '4 - Manuais': 'Manuais',
    '4 - Relatorios de Seguranca': 'Relatorios de Seguranca',
    '5 - Mapeamento de Processos': 'Mapeamento de Processos',
    '6 - Termos': 'Termos',
    '7 - Ficha Tecnica Indicadores': 'Ficha Tecnica Indicadores',
    '8 - Mapeamento dos Riscos': 'Mapeamento dos Riscos',
    '9 - Plano de Seguranca do Paciente': 'Plano de Seguranca do Paciente'
};

function extractCodeFromFilename(filename) {
    // Tentar extrair código do formato PRO.XXX.XXXX-XX ou similar
    const match = filename.match(/([A-Z]{2,}\.[A-Z0-9]+\.[0-9]+-[0-9]+)/);
    return match ? match[1] : '';
}

function getCategoryFromPath(filePath) {
    const pathParts = filePath.split(path.sep);
    for (const part of pathParts) {
        // Verificar se é uma pasta numerada (ex: "1 - Protocolos")
        if (part.includes(' - ')) {
            // Verificar se existe no mapeamento exato
            if (categoryMap[part]) {
                return categoryMap[part];
            }
            
            // Tentar encontrar correspondência
            for (const [key, value] of Object.entries(categoryMap)) {
                const folderName = key.split(' - ')[1];
                if (part.includes(folderName) || part === key) {
                    return value;
                }
            }
            
            // Se não encontrou, extrair nome da pasta sem número
            return getCategoryNameFromFolder(part);
        }
    }
    return 'Protocolos'; // Default
}

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
        } else {
            const ext = path.extname(file).toLowerCase();
            if (['.pdf', '.docx', '.odt'].includes(ext)) {
                arrayOfFiles.push(filePath);
            }
        }
    });

    return arrayOfFiles;
}

async function checkDuplicate(titulo, arquivoTipo) {
    // Verificar se já existe documento com mesmo título
    const tituloNormalizado = titulo.toLowerCase().trim();
    const snapshot = await db.collection('biblioteca_documentos')
        .where('titulo', '==', titulo)
        .get();
    
    if (snapshot.empty) {
        return null; // Não há duplicata
    }
    
    // Verificar se algum é PDF
    let existingPDF = null;
    let existingNonPDF = null;
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const tipo = data.arquivo?.nome ? data.arquivo.nome.split('.').pop().toLowerCase() : '';
        if (tipo === 'pdf') {
            existingPDF = { id: doc.id, data: data };
        } else {
            existingNonPDF = { id: doc.id, data: data };
        }
    });
    
    // Se novo é PDF e existe não-PDF, retornar o não-PDF para deletar
    if (arquivoTipo === 'pdf' && existingNonPDF) {
        return existingNonPDF;
    }
    
    // Se já existe PDF ou ambos são não-PDF, não adicionar
    if (existingPDF || existingNonPDF) {
        return 'skip'; // Pular este arquivo
    }
    
    return null;
}

async function uploadFile(filePath) {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(path.join(__dirname, '..', 'Documentos'), filePath);
    const arquivoTipo = path.extname(fileName).toLowerCase().replace('.', '');
    
    console.log(`\n📄 Processando: ${fileName}`);
    console.log(`   Caminho: ${relativePath}`);
    console.log(`   Tipo: ${arquivoTipo}`);

    try {
        // Ler arquivo
        const fileBuffer = fs.readFileSync(filePath);
        const fileStats = fs.statSync(filePath);

        // Determinar categoria
        const categoria = getCategoryFromPath(relativePath);
        console.log(`   Categoria: ${categoria}`);

        // Extrair código
        const codigo = extractCodeFromFilename(fileName);
        if (codigo) {
            console.log(`   Código: ${codigo}`);
        }

        // Criar título
        const titulo = fileName
            .replace(/\.(pdf|docx|odt)$/i, '')
            .replace(/^\d+_/, '')
            .trim();

        // Verificar duplicatas
        const duplicate = await checkDuplicate(titulo, arquivoTipo);
        if (duplicate === 'skip') {
            console.log(`   ⏭️  Duplicata encontrada, pulando...`);
            return { success: true, fileName, skipped: true };
        }
        
        if (duplicate) {
            console.log(`   🔄 Substituindo duplicata não-PDF por PDF...`);
            // Deletar o documento não-PDF existente
            await db.collection('biblioteca_documentos').doc(duplicate.id).delete();
            // Deletar arquivo do Storage se existir
            if (duplicate.data.arquivo?.storagePath) {
                try {
                    const oldFile = bucket.file(duplicate.data.arquivo.storagePath);
                    await oldFile.delete();
                    console.log(`   🗑️  Arquivo antigo removido do Storage`);
                } catch (err) {
                    console.warn(`   ⚠️  Erro ao remover arquivo antigo: ${err.message}`);
                }
            }
        }

        // Limpar nome do arquivo para evitar problemas
        const nomeLimpo = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Upload para Storage
        const timestamp = Date.now();
        const storageFileName = `${timestamp}_${nomeLimpo}`;
        const storagePath = `biblioteca_documentos/${storageFileName}`;
        const file = bucket.file(storagePath);

        console.log(`   📤 Fazendo upload para Storage...`);
        await file.save(fileBuffer, {
            metadata: {
                contentType: mime.lookup(filePath) || 'application/pdf',
            },
        });

        // Tornar arquivo público
        await file.makePublic();

        // Obter URL pública
        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        console.log(`   ✅ Upload concluído`);

        // Criar documento no Firestore
        const docData = {
            titulo: titulo,
            categoria: categoria,
            descricao: `Documento importado automaticamente de: ${relativePath}`,
            codigo: codigo,
            arquivo: {
                url: downloadURL,
                nome: fileName,
                tamanho: fileStats.size,
                storagePath: storagePath
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'sistema@importacao',
            createdByName: 'Sistema de Importação',
            ativo: true,
            importadoAutomaticamente: true
        };

        await db.collection('biblioteca_documentos').add(docData);
        console.log(`   ✅ Documento adicionado ao Firestore`);

        return { success: true, fileName, replaced: !!duplicate };

    } catch (error) {
        console.error(`   ❌ Erro ao processar ${fileName}:`, error.message);
        return { success: false, fileName, error: error.message };
    }
}

async function main() {
    console.log('🚀 Iniciando importação de documentos...\n');

    const documentosPath = path.join(__dirname, '..', 'Documentos');
    
    if (!fs.existsSync(documentosPath)) {
        console.error(`❌ Pasta Documentos não encontrada em: ${documentosPath}`);
        process.exit(1);
    }

    // Listar todos os arquivos
    const files = getAllFiles(documentosPath);
    console.log(`📁 Encontrados ${files.length} arquivos para importar\n`);

    if (files.length === 0) {
        console.log('⚠️ Nenhum arquivo encontrado para importar.');
        process.exit(0);
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    const results = [];

    // Processar cada arquivo
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`\n[${i + 1}/${files.length}]`);
        
        const result = await uploadFile(file);
        results.push(result);
        
        if (result.success) {
            if (result.skipped) {
                skippedCount++;
            } else if (result.replaced) {
                replacedCount++;
                successCount++;
            } else {
                successCount++;
            }
        } else {
            errorCount++;
        }

        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(50));
    console.log(`✅ Importados: ${successCount}`);
    console.log(`🔄 Substituídos (PDF preferido): ${replacedCount}`);
    console.log(`⏭️  Pulados (duplicatas): ${skippedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📄 Total processado: ${files.length}`);
    console.log('='.repeat(50));

    if (errorCount > 0) {
        console.log('\n⚠️ Arquivos com erro:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`   - ${r.fileName}: ${r.error}`);
        });
    }

    process.exit(errorCount > 0 ? 1 : 0);
}

// Executar
main().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});

