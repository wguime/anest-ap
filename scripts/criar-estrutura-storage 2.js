#!/usr/bin/env node

/**
 * Script para criar estrutura de pastas no Firebase Storage
 * exatamente como está configurada no aplicativo
 * 
 * Uso: node scripts/criar-estrutura-storage.js
 */

const admin = require('firebase-admin');

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

const storage = admin.storage();
const bucket = storage.bucket();

// Estrutura de pastas baseada no documento-manager.js
// Organizada na ordem que aparecem no aplicativo
const estruturaPastas = [
    // ==================== AUDITORIAS E CONFORMIDADES ====================
    {
        categoria: 'Auditorias e Conformidades',
        pastas: [
            'auditoria_higiene_maos',
            'auditoria_uso_medicamentos',
            'auditoria_abreviaturas',
            'politica_gestao_qualidade',
            'politica_disclosure'
        ]
    },
    
    // ==================== RELATÓRIOS DE SEGURANÇA ====================
    {
        categoria: 'Relatórios de Segurança',
        pastas: [
            'relatorio_trimestral',
            'relatorio_incidentes',
            'relatorio_auditorias',
            'relatorio_indicadores'
        ]
    },
    
    // ==================== BIBLIOTECA DE DOCUMENTOS (GERAL) ====================
    {
        categoria: 'Biblioteca de Documentos',
        pastas: [
            'biblioteca_documentos'
        ]
    },
    
    // ==================== KPIs - INDICADORES DE QUALIDADE ====================
    {
        categoria: 'KPIs - Indicadores de Qualidade',
        pastas: [
            'kpi_adesao_protocolos',
            'kpi_taxa_infeccao'
        ]
    },
    
    // ==================== BIBLIOTECA DE DOCUMENTOS - MEDICAMENTOS ====================
    {
        categoria: 'Biblioteca de Documentos - Medicamentos',
        pastas: [
            'doc_mav',
            'doc_eletrolitos',
            'doc_heparina',
            'doc_narcoticos',
            'doc_lista_abreviaturas',
            'doc_intoxicacao_anestesicos',
            'doc_manejo_glicemia'
        ]
    },
    
    // ==================== PROTOCOLOS ====================
    {
        categoria: 'Protocolos',
        pastas: [
            'protocolo_higiene_maos',
            'protocolo_prevencao_isc',
            'protocolo_prevencao_ics',
            'protocolo_prevencao_pav',
            'protocolo_prevencao_itu',
            'protocolo_prevencao_broncoaspiracao',
            'protocolo_prevencao_alergia_latex'
        ]
    },
    
    // ==================== CONCILIAÇÃO MEDICAMENTOSA ====================
    {
        categoria: 'Conciliação Medicamentosa',
        pastas: [
            'conciliacao_admissao',
            'conciliacao_transferencia',
            'conciliacao_alta'
        ]
    },
    
    // ==================== OUTROS ====================
    {
        categoria: 'Outros',
        pastas: [
            'protocolo_institucional',
            'checklist_cirurgia'
        ]
    }
];

/**
 * Cria uma pasta no Storage criando um arquivo placeholder
 * No Firebase Storage, pastas são criadas automaticamente quando você faz upload de um arquivo
 */
async function criarPasta(pastaPath) {
    try {
        // Criar um arquivo placeholder para garantir que a pasta existe
        const placeholderPath = `${pastaPath}/.placeholder`;
        const file = bucket.file(placeholderPath);
        
        // Verificar se já existe
        const [exists] = await file.exists();
        if (exists) {
            return { success: true, message: 'Pasta já existe', path: pastaPath };
        }
        
        // Criar arquivo placeholder vazio
        await file.save('', {
            metadata: {
                contentType: 'text/plain',
                metadata: {
                    createdBy: 'criar-estrutura-storage.js',
                    createdAt: new Date().toISOString(),
                    purpose: 'folder-placeholder'
                }
            }
        });
        
        // Tornar público (opcional)
        await file.makePublic().catch(() => {
            // Ignorar erro se já for público ou se não tiver permissão
        });
        
        return { success: true, message: 'Pasta criada', path: pastaPath };
    } catch (error) {
        return { success: false, message: error.message, path: pastaPath };
    }
}

/**
 * Cria todas as pastas da estrutura
 */
async function criarEstruturaCompleta() {
    console.log('🚀 Criando estrutura de pastas no Firebase Storage...\n');
    console.log('='.repeat(80));
    
    let totalPastas = 0;
    let pastasCriadas = 0;
    let pastasExistentes = 0;
    let erros = 0;
    
    for (const grupo of estruturaPastas) {
        console.log(`\n📁 ${grupo.categoria}`);
        console.log('-'.repeat(80));
        
        for (const pasta of grupo.pastas) {
            totalPastas++;
            process.stdout.write(`   📂 ${pasta}... `);
            
            const resultado = await criarPasta(pasta);
            
            if (resultado.success) {
                if (resultado.message === 'Pasta já existe') {
                    console.log('✅ (já existe)');
                    pastasExistentes++;
                } else {
                    console.log('✅');
                    pastasCriadas++;
                }
            } else {
                console.log(`❌ Erro: ${resultado.message}`);
                erros++;
            }
            
            // Pequeno delay para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO');
    console.log('='.repeat(80));
    console.log(`Total de pastas processadas: ${totalPastas}`);
    console.log(`✅ Pastas criadas: ${pastasCriadas}`);
    console.log(`ℹ️  Pastas já existentes: ${pastasExistentes}`);
    if (erros > 0) {
        console.log(`❌ Erros: ${erros}`);
    }
    console.log('\n✅ Estrutura criada com sucesso!');
    console.log('\n💡 Nota: As pastas no Firebase Storage são criadas automaticamente');
    console.log('   quando você faz upload de arquivos. Os arquivos .placeholder');
    console.log('   garantem que a estrutura exista mesmo sem arquivos ainda.');
}

// Executar
criarEstruturaCompleta()
    .then(() => {
        console.log('\n🎉 Processo concluído!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Erro fatal:', error);
        process.exit(1);
    });

