#!/usr/bin/env node

// Script para popular documentos de teste nas categorias de Protocolos
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Definir documentos de teste para cada categoria
const documentosPorCategoria = {
    // Medicamentos
    'doc_mav': {
        titulo: 'Gestão de Medicamentos de Alta Vigilância',
        descricao: 'Protocolo para gestão segura de medicamentos de alta vigilância (MAV)',
        arquivoNome: 'PRO.INSH.0080-13 Gestão de Medicamentos de Alta Vigilância.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPRO.INSH.0080-13%20Gestao%20de%20Medicamentos%20de%20Alta%20Vigilancia%20(AG.%20Iara%2030.04.24).docx.pdf?alt=media'
    },
    'doc_intoxicacao_anestesicos': {
        titulo: 'Prevenção e Manejo de Intoxicação por Anestésicos Locais',
        descricao: 'Protocolo para prevenção e manejo de intoxicação por anestésicos locais',
        arquivoNome: 'PRO.CCG.0020-00 Prevenção e Manejo de Intoxicação.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPRO.CCG.0020-00%20Prevencao%20e%20manejo%20de%20intoxicacao%20por%20anestesicos%20locais.pdf?alt=media'
    },
    'doc_manejo_glicemia': {
        titulo: 'Protocolo de Manejo da Glicemia',
        descricao: 'Protocolo para manejo adequado dos níveis glicêmicos em pacientes cirúrgicos',
        arquivoNome: 'PRO.INSH.0094_00 Manejo Glicemia.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPRO.INSH.0094_00%20Manejo%20glicemia.pdf?alt=media'
    },
    'doc_heparina': {
        titulo: 'Segurança no Uso da Heparina',
        descricao: 'Protocolo para uso seguro de heparina e prevenção de erros',
        arquivoNome: 'Protocolo_Seguranca_Heparina.pdf',
        arquivoURL: ''  // URL a ser definida
    },
    'doc_eletrolitos': {
        titulo: 'Protocolo de Eletrólitos Concentrados',
        descricao: 'Gestão segura de eletrólitos concentrados (potássio, magnésio, cálcio)',
        arquivoNome: 'Protocolo_Eletrolitos_Concentrados.pdf',
        arquivoURL: ''  // URL a ser definida
    },
    'doc_narcoticos': {
        titulo: 'Segurança dos Narcóticos',
        descricao: 'Protocolo para controle e segurança no uso de medicamentos narcóticos',
        arquivoNome: 'Protocolo_Seguranca_Narcoticos.pdf',
        arquivoURL: ''  // URL a ser definida
    },
    'doc_lista_abreviaturas': {
        titulo: 'Lista de Abreviaturas Perigosas',
        descricao: 'Lista oficial de abreviaturas que não devem ser utilizadas',
        arquivoNome: 'Lista_Abreviaturas_Perigosas.pdf',
        arquivoURL: ''  // URL a ser definida
    },

    // Protocolos de Prevenção
    'protocolo_higiene_maos': {
        titulo: 'Protocolo de Higiene das Mãos',
        descricao: 'Os 5 momentos da higienização das mãos segundo a OMS',
        arquivoNome: 'PT 03 Higiene de Maos.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPT%2003%20Higiene%20de%20Maos.pdf?alt=media'
    },
    'protocolo_prevencao_broncoaspiracao': {
        titulo: 'Prevenção da Broncoaspiração',
        descricao: 'Protocolo para prevenção de broncoaspiração em pacientes cirúrgicos',
        arquivoNome: 'PRO.INSH.0007-16 Protocolo de Prevenção da Broncoaspiração.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPRO.INSH.0007-16%20Protocolo%20de%20prevencao%20da%20broncoaspiracao..pdf?alt=media'
    },
    'protocolo_prevencao_alergia_latex': {
        titulo: 'Prevenção de Alergia ao Látex',
        descricao: 'Protocolo para identificação e prevenção de reações alérgicas ao látex',
        arquivoNome: 'PRO.INSH.0009-04 Prevenção de Alergia ao Látex.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPRO.INSH.0009-04%20Prevencao%20de%20Alergia%20ao%20latex(AG.%20Anest%2015.02.24).pdf?alt=media'
    },

    // Bundles IRAS
    'protocolo_prevencao_isc': {
        titulo: 'Bundle de Prevenção de Infecção de Sítio Cirúrgico',
        descricao: 'Bundle baseado em evidências para prevenção de ISC',
        arquivoNome: 'PRO.SCI.0007-14 Antibioticoprofilaxia Cirúrgica.pdf',
        arquivoURL: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/Documentos%2F1%20-%20Protocolos%2FPRO.SCI.0007-14%20Antibioticoprofilaxia%20cirurgica.pdf?alt=media'
    },
    'protocolo_prevencao_ics': {
        titulo: 'Bundle de Prevenção de Infecção de Corrente Sanguínea',
        descricao: 'Bundle para prevenção de ICS relacionada a cateter venoso central',
        arquivoNome: 'Bundle_Prevencao_ICS.pdf',
        arquivoURL: ''  // URL a ser definida
    },
    'protocolo_prevencao_pav': {
        titulo: 'Bundle de Prevenção de Pneumonia Associada à Ventilação',
        descricao: 'Bundle baseado em evidências para prevenção de PAV',
        arquivoNome: 'Bundle_Prevencao_PAV.pdf',
        arquivoURL: ''  // URL a ser definida
    },
    'protocolo_prevencao_itu': {
        titulo: 'Bundle de Prevenção de Infecção do Trato Urinário',
        descricao: 'Bundle para prevenção de ITU relacionada a cateter vesical',
        arquivoNome: 'Bundle_Prevencao_ITU.pdf',
        arquivoURL: ''  // URL a ser definida
    }
};

async function popularDocumentos() {
    console.log('📚 Iniciando população de documentos de Protocolos...\n');

    for (const [colecao, dados] of Object.entries(documentosPorCategoria)) {
        try {
            console.log(`📄 Processando: ${colecao}`);

            // Verificar se já existe documento
            const snapshot = await db.collection(colecao).limit(1).get();

            if (!snapshot.empty) {
                console.log(`   ⚠️  Já existe documento em ${colecao}, pulando...`);
                continue;
            }

            // Criar documento
            const documento = {
                titulo: dados.titulo,
                descricao: dados.descricao,
                data: admin.firestore.FieldValue.serverTimestamp(),
                autorNome: 'Administração',
                autorId: 'admin',
                ativo: true
            };

            // Adicionar URL do arquivo se existir
            if (dados.arquivoURL) {
                documento.arquivoURL = dados.arquivoURL;
                documento.arquivoNome = dados.arquivoNome;
            }

            await db.collection(colecao).add(documento);
            console.log(`   ✅ Documento criado com sucesso!`);

        } catch (error) {
            console.error(`   ❌ Erro ao processar ${colecao}:`, error.message);
        }
    }

    console.log('\n✅ População de documentos concluída!');
    process.exit(0);
}

popularDocumentos().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
