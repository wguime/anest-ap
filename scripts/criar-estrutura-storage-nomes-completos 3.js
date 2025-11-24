#!/usr/bin/env node

/**
 * Script para criar estrutura de pastas no Firebase Storage
 * com nomes COMPLETOS (sem abreviações), exatamente como aparecem no aplicativo
 * 
 * Uso: node scripts/criar-estrutura-storage-nomes-completos.js
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

/**
 * Sanitiza o nome da pasta para ser compatível com URLs
 * Remove acentos, espaços vira hífen, tudo minúsculo
 */
function sanitizarNomePasta(nome) {
    return nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .toLowerCase()
        .replace(/\s+/g, '-') // Espaços viram hífen
        .replace(/[^a-z0-9-]/g, '') // Remove caracteres especiais
        .replace(/-+/g, '-') // Múltiplos hífens viram um
        .replace(/^-|-$/g, ''); // Remove hífens no início/fim
}

// Estrutura de pastas com NOMES COMPLETOS baseada no documento-manager.js
// Organizada na ordem que aparecem no aplicativo
const estruturaPastas = [
    // ==================== AUDITORIAS E CONFORMIDADES ====================
    {
        categoria: 'Auditorias e Conformidades',
        pastas: [
            { nomeCompleto: 'Higiene das Mãos', nomeAbreviado: 'auditoria_higiene_maos' },
            { nomeCompleto: 'Uso de Medicamentos', nomeAbreviado: 'auditoria_uso_medicamentos' },
            { nomeCompleto: 'Abreviaturas Perigosas', nomeAbreviado: 'auditoria_abreviaturas' },
            { nomeCompleto: 'Política de Gestão da Qualidade', nomeAbreviado: 'politica_gestao_qualidade' },
            { nomeCompleto: 'Política de Disclosure', nomeAbreviado: 'politica_disclosure' }
        ]
    },
    
    // ==================== RELATÓRIOS DE SEGURANÇA ====================
    {
        categoria: 'Relatórios de Segurança',
        pastas: [
            { nomeCompleto: 'Relatório Trimestral', nomeAbreviado: 'relatorio_trimestral' },
            { nomeCompleto: 'Consolidado de Incidentes', nomeAbreviado: 'relatorio_incidentes' },
            { nomeCompleto: 'Relatório de Auditorias', nomeAbreviado: 'relatorio_auditorias' },
            { nomeCompleto: 'Indicadores de Qualidade', nomeAbreviado: 'relatorio_indicadores' }
        ]
    },
    
    // ==================== BIBLIOTECA DE DOCUMENTOS (GERAL) ====================
    {
        categoria: 'Biblioteca de Documentos',
        pastas: [
            { nomeCompleto: 'Biblioteca de Documentos', nomeAbreviado: 'biblioteca_documentos' }
        ]
    },
    
    // ==================== KPIs - INDICADORES DE QUALIDADE ====================
    {
        categoria: 'KPIs - Indicadores de Qualidade',
        pastas: [
            { nomeCompleto: 'KPI - Adesão aos Protocolos', nomeAbreviado: 'kpi_adesao_protocolos' },
            { nomeCompleto: 'KPI - Taxa de Infecção', nomeAbreviado: 'kpi_taxa_infeccao' }
        ]
    },
    
    // ==================== BIBLIOTECA DE DOCUMENTOS - MEDICAMENTOS ====================
    {
        categoria: 'Biblioteca de Documentos - Medicamentos',
        pastas: [
            { nomeCompleto: 'Medicamentos de Alta Vigilância', nomeAbreviado: 'doc_mav' },
            { nomeCompleto: 'Eletrólitos Concentrados', nomeAbreviado: 'doc_eletrolitos' },
            { nomeCompleto: 'Segurança no Uso da Heparina', nomeAbreviado: 'doc_heparina' },
            { nomeCompleto: 'Segurança dos Narcóticos', nomeAbreviado: 'doc_narcoticos' },
            { nomeCompleto: 'Lista de Abreviaturas Perigosas', nomeAbreviado: 'doc_lista_abreviaturas' },
            { nomeCompleto: 'Intoxicação por Anestésicos Locais', nomeAbreviado: 'doc_intoxicacao_anestesicos' },
            { nomeCompleto: 'Manejo da Glicemia', nomeAbreviado: 'doc_manejo_glicemia' }
        ]
    },
    
    // ==================== PROTOCOLOS ====================
    {
        categoria: 'Protocolos',
        pastas: [
            { nomeCompleto: 'Protocolo de Higiene das Mãos', nomeAbreviado: 'protocolo_higiene_maos' },
            { nomeCompleto: 'Prevenção de Infecção de Sítio Cirúrgico', nomeAbreviado: 'protocolo_prevencao_isc' },
            { nomeCompleto: 'Prevenção de Infecção de Corrente Sanguínea', nomeAbreviado: 'protocolo_prevencao_ics' },
            { nomeCompleto: 'Prevenção de Pneumonia Associada à Ventilação', nomeAbreviado: 'protocolo_prevencao_pav' },
            { nomeCompleto: 'Prevenção de Infecção do Trato Urinário', nomeAbreviado: 'protocolo_prevencao_itu' },
            { nomeCompleto: 'Prevenção da Broncoaspiração', nomeAbreviado: 'protocolo_prevencao_broncoaspiracao' },
            { nomeCompleto: 'Prevenção de Alergia ao Látex', nomeAbreviado: 'protocolo_prevencao_alergia_latex' }
        ]
    },
    
    // ==================== CONCILIAÇÃO MEDICAMENTOSA ====================
    {
        categoria: 'Conciliação Medicamentosa',
        pastas: [
            { nomeCompleto: 'Conciliação na Admissão', nomeAbreviado: 'conciliacao_admissao' },
            { nomeCompleto: 'Conciliação na Transferência', nomeAbreviado: 'conciliacao_transferencia' },
            { nomeCompleto: 'Conciliação na Alta', nomeAbreviado: 'conciliacao_alta' }
        ]
    },
    
    // ==================== OUTROS ====================
    {
        categoria: 'Outros',
        pastas: [
            { nomeCompleto: 'Protocolo Institucional', nomeAbreviado: 'protocolo_institucional' },
            { nomeCompleto: 'Checklist de Cirurgia Segura', nomeAbreviado: 'checklist_cirurgia' }
        ]
    }
];

/**
 * Cria uma pasta no Storage criando um arquivo placeholder
 */
async function criarPasta(pastaPath, nomeCompleto) {
    try {
        // Criar um arquivo placeholder para garantir que a pasta existe
        const placeholderPath = `${pastaPath}/.placeholder`;
        const file = bucket.file(placeholderPath);
        
        // Verificar se já existe
        const [exists] = await file.exists();
        if (exists) {
            return { success: true, message: 'Pasta já existe', path: pastaPath, nomeCompleto };
        }
        
        // Criar arquivo placeholder vazio
        await file.save('', {
            metadata: {
                contentType: 'text/plain',
                metadata: {
                    createdBy: 'criar-estrutura-storage-nomes-completos.js',
                    createdAt: new Date().toISOString(),
                    purpose: 'folder-placeholder',
                    nomeCompleto: nomeCompleto
                }
            }
        });
        
        // Tornar público (opcional)
        await file.makePublic().catch(() => {
            // Ignorar erro se já for público ou se não tiver permissão
        });
        
        return { success: true, message: 'Pasta criada', path: pastaPath, nomeCompleto };
    } catch (error) {
        return { success: false, message: error.message, path: pastaPath, nomeCompleto };
    }
}

/**
 * Cria todas as pastas da estrutura com nomes completos
 */
async function criarEstruturaCompleta() {
    console.log('🚀 Criando estrutura de pastas no Firebase Storage...');
    console.log('📝 Usando NOMES COMPLETOS (sem abreviações)\n');
    console.log('='.repeat(80));
    
    let totalPastas = 0;
    let pastasCriadas = 0;
    let pastasExistentes = 0;
    let erros = 0;
    
    for (const grupo of estruturaPastas) {
        console.log(`\n📁 ${grupo.categoria}`);
        console.log('-'.repeat(80));
        
        for (const pastaInfo of grupo.pastas) {
            totalPastas++;
            const nomeCompleto = pastaInfo.nomeCompleto;
            const nomeSanitizado = sanitizarNomePasta(nomeCompleto);
            
            process.stdout.write(`   📂 ${nomeCompleto} (${nomeSanitizado})... `);
            
            const resultado = await criarPasta(nomeSanitizado, nomeCompleto);
            
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
    console.log('\n💡 Nota: As pastas foram criadas com nomes completos sanitizados');
    console.log('   (sem espaços, sem acentos, tudo minúsculo com hífens)');
    console.log('   Exemplo: "Medicamentos de Alta Vigilância" → "medicamentos-de-alta-vigilancia"');
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

