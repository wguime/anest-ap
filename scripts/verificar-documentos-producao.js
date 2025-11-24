#!/usr/bin/env node

/**
 * Script para verificar documentos existentes em produção e comparar com o esperado
 * 
 * Uso: node scripts/verificar-documentos-producao.js
 * 
 * Requer: Firebase Admin SDK configurado
 */

const admin = require('firebase-admin');

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

// Todas as collections que devem ter documentos
const todasCollections = [
    // Auditorias e Conformidades
    'auditoria_higiene_maos',
    'auditoria_uso_medicamentos',
    'auditoria_abreviaturas',
    'politica_gestao_qualidade',
    'politica_disclosure',
    
    // Relatórios de Segurança
    'relatorio_trimestral',
    'relatorio_incidentes',
    'relatorio_auditorias',
    'relatorio_indicadores',
    
    // Biblioteca de Documentos - Medicamentos
    'doc_mav',
    'doc_eletrolitos',
    'doc_heparina',
    'doc_narcoticos',
    'doc_lista_abreviaturas',
    'doc_intoxicacao_anestesicos',
    'doc_manejo_glicemia',
    
    // Protocolos de Prevenção
    'protocolo_higiene_maos',
    'protocolo_prevencao_isc',
    'protocolo_prevencao_ics',
    'protocolo_prevencao_pav',
    'protocolo_prevencao_itu',
    'protocolo_prevencao_broncoaspiracao',
    'protocolo_prevencao_alergia_latex',
    
    // Conciliação Medicamentosa
    'conciliacao_admissao',
    'conciliacao_transferencia',
    'conciliacao_alta',
    'protocolo_institucional',
    
    // KPIs
    'kpi_adesao_protocolos',
    'kpi_taxa_infeccao',
    
    // Outros
    'checklist_cirurgia',
    'biblioteca_documentos'
];

async function verificarCollection(nomeColecao) {
    try {
        // Buscar todos os documentos ativos
        const snapshot = await db.collection(nomeColecao)
            .where('ativo', '==', true)
            .get();
        
        const documentos = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            documentos.push({
                id: doc.id,
                titulo: data.titulo || 'Sem título',
                descricao: data.descricao || '',
                arquivoURL: data.arquivoURL || data.arquivo?.url || '',
                arquivoNome: data.arquivoNome || data.arquivo?.nome || '',
                data: data.data?.toDate?.() || null,
                ativo: data.ativo !== false
            });
        });
        
        return {
            colecao: nomeColecao,
            total: documentos.length,
            documentos: documentos,
            sucesso: true
        };
    } catch (error) {
        // Se a collection não existir ou houver erro, retornar vazio
        if (error.code === 5 || error.message.includes('not found')) {
            return {
                colecao: nomeColecao,
                total: 0,
                documentos: [],
                sucesso: true,
                erro: 'Collection não existe'
            };
        }
        
        return {
            colecao: nomeColecao,
            total: 0,
            documentos: [],
            sucesso: false,
            erro: error.message
        };
    }
}

async function main() {
    console.log('🔍 Verificando documentos em produção...\n');
    console.log('='.repeat(80));
    
    const resultados = [];
    
    for (let i = 0; i < todasCollections.length; i++) {
        const nomeColecao = todasCollections[i];
        process.stdout.write(`\r📊 Verificando ${i + 1}/${todasCollections.length}: ${nomeColecao}...`);
        
        const resultado = await verificarCollection(nomeColecao);
        resultados.push(resultado);
        
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\r' + ' '.repeat(80));
    console.log('\n' + '='.repeat(80));
    console.log('📊 RELATÓRIO DE DOCUMENTOS EM PRODUÇÃO');
    console.log('='.repeat(80));
    
    // Separar por status
    const comDocumentos = resultados.filter(r => r.total > 0);
    const semDocumentos = resultados.filter(r => r.total === 0 && r.sucesso);
    const comErro = resultados.filter(r => !r.sucesso);
    
    console.log(`\n✅ Coleções com documentos: ${comDocumentos.length}`);
    console.log(`⚠️  Coleções sem documentos: ${semDocumentos.length}`);
    console.log(`❌ Coleções com erro: ${comErro.length}`);
    console.log(`📋 Total de coleções verificadas: ${resultados.length}`);
    
    // Mostrar coleções com documentos
    if (comDocumentos.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('✅ COLECÕES COM DOCUMENTOS');
        console.log('='.repeat(80));
        
        comDocumentos.forEach(r => {
            console.log(`\n📄 ${r.colecao} (${r.total} documento${r.total > 1 ? 's' : ''})`);
            r.documentos.forEach((doc, idx) => {
                console.log(`   ${idx + 1}. ${doc.titulo}`);
                if (doc.arquivoNome) {
                    console.log(`      Arquivo: ${doc.arquivoNome}`);
                }
                if (doc.data) {
                    console.log(`      Data: ${doc.data.toLocaleDateString('pt-BR')}`);
                }
            });
        });
    }
    
    // Mostrar coleções sem documentos
    if (semDocumentos.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('⚠️  COLECÕES SEM DOCUMENTOS');
        console.log('='.repeat(80));
        
        semDocumentos.forEach(r => {
            console.log(`   - ${r.colecao}${r.erro ? ` (${r.erro})` : ''}`);
        });
    }
    
    // Mostrar erros
    if (comErro.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('❌ ERROS AO VERIFICAR');
        console.log('='.repeat(80));
        
        comErro.forEach(r => {
            console.log(`\n❌ ${r.colecao}`);
            console.log(`   Erro: ${r.erro}`);
        });
    }
    
    // Resumo estatístico
    console.log('\n' + '='.repeat(80));
    console.log('📈 RESUMO ESTATÍSTICO');
    console.log('='.repeat(80));
    
    const totalDocumentos = resultados.reduce((sum, r) => sum + r.total, 0);
    const colecoesComDocs = comDocumentos.length;
    const colecoesSemDocs = semDocumentos.length;
    const taxaCobertura = ((colecoesComDocs / todasCollections.length) * 100).toFixed(1);
    
    console.log(`\n📊 Total de documentos encontrados: ${totalDocumentos}`);
    console.log(`📁 Coleções com documentos: ${colecoesComDocs}`);
    console.log(`📭 Coleções sem documentos: ${colecoesSemDocs}`);
    console.log(`📈 Taxa de cobertura: ${taxaCobertura}%`);
    
    // Listar documentos faltantes prioritários
    console.log('\n' + '='.repeat(80));
    console.log('🎯 DOCUMENTOS FALTANTES PRIORITÁRIOS');
    console.log('='.repeat(80));
    
    const prioritarios = [
        { colecao: 'doc_mav', nome: 'Medicamentos de Alta Vigilância', prioridade: '🔴 Alta' },
        { colecao: 'protocolo_prevencao_isc', nome: 'Antibioticoprofilaxia Cirúrgica', prioridade: '🔴 Alta' },
        { colecao: 'relatorio_incidentes', nome: 'Consolidado de Incidentes', prioridade: '🔴 Alta' },
        { colecao: 'relatorio_auditorias', nome: 'Relatório de Auditorias', prioridade: '🟡 Média' },
        { colecao: 'doc_lista_abreviaturas', nome: 'Lista de Abreviaturas Perigosas', prioridade: '🟡 Média' },
        { colecao: 'protocolo_institucional', nome: 'Protocolo Institucional', prioridade: '🟡 Média' }
    ];
    
    prioritarios.forEach(p => {
        const resultado = resultados.find(r => r.colecao === p.colecao);
        if (resultado && resultado.total === 0) {
            console.log(`\n${p.prioridade} ${p.nome}`);
            console.log(`   Collection: ${p.colecao}`);
            console.log(`   Status: Sem documentos`);
        }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 PRÓXIMOS PASSOS');
    console.log('='.repeat(80));
    console.log('\n1. Execute o script de vinculação:');
    console.log('   node scripts/vincular-documentos-cards.js');
    console.log('\n2. Ou adicione documentos manualmente pela interface web');
    console.log('\n3. Verifique novamente após adicionar:');
    console.log('   node scripts/verificar-documentos-producao.js');
    console.log('\n' + '='.repeat(80));
    
    process.exit(0);
}

// Executar
main().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});

