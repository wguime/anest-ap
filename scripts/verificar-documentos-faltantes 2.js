#!/usr/bin/env node

/**
 * Script para verificar quais documentos estão faltando nas coleções do Firestore
 * 
 * Uso: node scripts/verificar-documentos-faltantes.js
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

// Coleções que devem ter documentos (baseado na documentação)
const colecoesEsperadas = {
    // Auditorias e Conformidades
    'auditoria_higiene_maos': {
        nome: 'Higiene das Mãos',
        esperado: 0 // Sem documento específico ainda
    },
    'auditoria_uso_medicamentos': {
        nome: 'Uso de Medicamentos',
        esperado: 0
    },
    'auditoria_abreviaturas': {
        nome: 'Abreviaturas Perigosas',
        esperado: 0
    },
    'politica_gestao_qualidade': {
        nome: 'Política de Gestão da Qualidade',
        esperado: 1
    },
    'politica_disclosure': {
        nome: 'Política de Disclosure',
        esperado: 1
    },
    
    // Relatórios de Segurança
    'relatorio_trimestral': {
        nome: 'Relatório Trimestral',
        esperado: 1
    },
    'relatorio_incidentes': {
        nome: 'Consolidado de Incidentes',
        esperado: 0
    },
    'relatorio_auditorias': {
        nome: 'Relatório de Auditorias',
        esperado: 0
    },
    'relatorio_indicadores': {
        nome: 'Indicadores de Qualidade',
        esperado: 1
    },
    
    // Biblioteca de Documentos - Medicamentos
    'doc_mav': {
        nome: 'Medicamentos de Alta Vigilância',
        esperado: 0
    },
    'doc_eletrolitos': {
        nome: 'Eletrólitos Concentrados',
        esperado: 0
    },
    'doc_heparina': {
        nome: 'Segurança no Uso da Heparina',
        esperado: 0
    },
    'doc_narcoticos': {
        nome: 'Segurança dos Narcóticos',
        esperado: 0
    },
    'doc_lista_abreviaturas': {
        nome: 'Lista de Abreviaturas Perigosas',
        esperado: 0
    },
    'doc_intoxicacao_anestesicos': {
        nome: 'Intoxicação por Anestésicos Locais',
        esperado: 1
    },
    'doc_manejo_glicemia': {
        nome: 'Manejo da Glicemia',
        esperado: 1
    },
    
    // Protocolos de Prevenção
    'protocolo_higiene_maos': {
        nome: 'Protocolo de Higiene das Mãos',
        esperado: 1
    },
    'protocolo_prevencao_isc': {
        nome: 'Prevenção de Infecção de Sítio Cirúrgico',
        esperado: 0
    },
    'protocolo_prevencao_ics': {
        nome: 'Prevenção de Infecção de Corrente Sanguínea',
        esperado: 0
    },
    'protocolo_prevencao_pav': {
        nome: 'Prevenção de Pneumonia Associada à Ventilação',
        esperado: 0
    },
    'protocolo_prevencao_itu': {
        nome: 'Prevenção de Infecção do Trato Urinário',
        esperado: 0
    },
    'protocolo_prevencao_broncoaspiracao': {
        nome: 'Prevenção da Broncoaspiração',
        esperado: 1
    },
    'protocolo_prevencao_alergia_latex': {
        nome: 'Prevenção de Alergia ao Látex',
        esperado: 1
    },
    
    // Conciliação Medicamentosa
    'conciliacao_admissao': {
        nome: 'Conciliação na Admissão',
        esperado: 0
    },
    'conciliacao_transferencia': {
        nome: 'Conciliação na Transferência',
        esperado: 0
    },
    'conciliacao_alta': {
        nome: 'Conciliação na Alta',
        esperado: 0
    },
    'protocolo_institucional': {
        nome: 'Protocolo Institucional',
        esperado: 0
    },
    
    // KPIs
    'kpi_adesao_protocolos': {
        nome: 'KPI - Adesão aos Protocolos',
        esperado: 0
    },
    'kpi_taxa_infeccao': {
        nome: 'KPI - Taxa de Infecção',
        esperado: 0
    },
    
    // Outros
    'checklist_cirurgia': {
        nome: 'Checklist de Cirurgia Segura',
        esperado: 0
    },
    'biblioteca_documentos': {
        nome: 'Biblioteca de Documentos (geral)',
        esperado: 0
    }
};

async function verificarColecao(nomeColecao, config) {
    try {
        const snapshot = await db.collection(nomeColecao)
            .where('ativo', '==', true)
            .get();
        
        const count = snapshot.size;
        const documentos = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            documentos.push({
                id: doc.id,
                titulo: data.titulo || 'Sem título',
                ativo: data.ativo !== false
            });
        });
        
        return {
            nome: config.nome,
            colecao: nomeColecao,
            encontrados: count,
            esperados: config.esperado,
            status: count >= config.esperado ? 'ok' : 'faltando',
            documentos: documentos
        };
    } catch (error) {
        return {
            nome: config.nome,
            colecao: nomeColecao,
            encontrados: 0,
            esperados: config.esperado,
            status: 'erro',
            erro: error.message,
            documentos: []
        };
    }
}

async function main() {
    console.log('🔍 Verificando documentos faltantes no Firestore...\n');
    console.log('='.repeat(80));
    
    const resultados = [];
    const colecoes = Object.keys(colecoesEsperadas);
    
    for (let i = 0; i < colecoes.length; i++) {
        const nomeColecao = colecoes[i];
        const config = colecoesEsperadas[nomeColecao];
        
        process.stdout.write(`\r📊 Verificando ${i + 1}/${colecoes.length}: ${config.nome}...`);
        
        const resultado = await verificarColecao(nomeColecao, config);
        resultados.push(resultado);
        
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\r' + ' '.repeat(80));
    console.log('\n' + '='.repeat(80));
    console.log('📊 RELATÓRIO DE DOCUMENTOS');
    console.log('='.repeat(80));
    
    // Separar por status
    const ok = resultados.filter(r => r.status === 'ok');
    const faltando = resultados.filter(r => r.status === 'faltando');
    const erro = resultados.filter(r => r.status === 'erro');
    
    console.log(`\n✅ Coleções OK: ${ok.length}`);
    console.log(`⚠️  Coleções com documentos faltantes: ${faltando.length}`);
    console.log(`❌ Coleções com erro: ${erro.length}`);
    console.log(`📋 Total de coleções: ${resultados.length}`);
    
    // Mostrar coleções faltando documentos
    if (faltando.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('⚠️  DOCUMENTOS FALTANTES');
        console.log('='.repeat(80));
        
        faltando.forEach(r => {
            console.log(`\n📄 ${r.nome}`);
            console.log(`   Collection: ${r.colecao}`);
            console.log(`   Encontrados: ${r.encontrados}`);
            console.log(`   Esperados: ${r.esperados}`);
            console.log(`   Faltam: ${r.esperados - r.encontrados}`);
            
            if (r.documentos.length > 0) {
                console.log(`   Documentos existentes:`);
                r.documentos.forEach(doc => {
                    console.log(`     - ${doc.titulo} (ID: ${doc.id})`);
                });
            }
        });
    }
    
    // Mostrar coleções com erro
    if (erro.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('❌ ERROS AO VERIFICAR');
        console.log('='.repeat(80));
        
        erro.forEach(r => {
            console.log(`\n❌ ${r.nome}`);
            console.log(`   Collection: ${r.colecao}`);
            console.log(`   Erro: ${r.erro}`);
        });
    }
    
    // Mostrar coleções vazias (sem documentos esperados mas que podem ter)
    const vazias = resultados.filter(r => r.status === 'ok' && r.encontrados === 0 && r.esperados === 0);
    if (vazias.length > 0) {
        console.log('\n' + '='.repeat(80));
        console.log('📭 COLECÕES VAZIAS (sem documentos esperados)');
        console.log('='.repeat(80));
        
        vazias.forEach(r => {
            console.log(`   - ${r.nome} (${r.colecao})`);
        });
    }
    
    // Resumo final
    console.log('\n' + '='.repeat(80));
    console.log('📈 RESUMO');
    console.log('='.repeat(80));
    
    const totalEsperado = resultados.reduce((sum, r) => sum + r.esperados, 0);
    const totalEncontrado = resultados.reduce((sum, r) => sum + r.encontrados, 0);
    const totalFaltando = totalEsperado - totalEncontrado;
    
    console.log(`\n📊 Total de documentos esperados: ${totalEsperado}`);
    console.log(`✅ Total de documentos encontrados: ${totalEncontrado}`);
    console.log(`⚠️  Total de documentos faltantes: ${totalFaltando > 0 ? totalFaltando : 0}`);
    
    if (totalFaltando > 0) {
        console.log(`\n💡 Para adicionar documentos faltantes:`);
        console.log(`   1. Use a interface web (botão "Novo Documento")`);
        console.log(`   2. Ou execute: node scripts/vincular-documentos-cards.js`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    process.exit(0);
}

// Executar
main().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});

