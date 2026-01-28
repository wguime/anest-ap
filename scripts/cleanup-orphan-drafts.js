/**
 * cleanup-orphan-drafts.js
 * Script para limpar entidades DRAFT órfãs (sem vínculo) após X dias
 * 
 * Uso:
 *   node scripts/cleanup-orphan-drafts.js [--dry-run] [--days=7]
 * 
 * Opções:
 *   --dry-run   Apenas mostra o que seria deletado, sem deletar
 *   --days=N    Considera órfão após N dias (padrão: 7)
 * 
 * Requisitos:
 *   - serviceAccountKey.json na pasta scripts/
 */

const admin = require('firebase-admin');
const path = require('path');

// Configuração
const DEFAULT_DAYS = 7;
const COLLECTIONS = {
  TRILHAS: 'educacao_trilhas',
  CURSOS: 'educacao_cursos',
  MODULOS: 'educacao_modulos',
  AULAS: 'educacao_aulas',
  TRILHA_CURSOS: 'educacao_trilha_cursos',
  CURSO_MODULOS: 'educacao_curso_modulos',
  MODULO_AULAS: 'educacao_modulo_aulas',
};

// Inicializar Firebase Admin
function initFirebase() {
  if (admin.apps.length) return admin.firestore();
  
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin inicializado com sucesso.');
    return admin.firestore();
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error.message);
    console.error('Certifique-se de que serviceAccountKey.json existe em scripts/');
    process.exit(1);
  }
}

// Parsear argumentos da linha de comando
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    dryRun: false,
    days: DEFAULT_DAYS,
  };

  args.forEach(arg => {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--days=')) {
      config.days = parseInt(arg.split('=')[1], 10) || DEFAULT_DAYS;
    }
  });

  return config;
}

// Calcular data limite (X dias atrás)
function getThresholdDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Buscar IDs de entidades vinculadas em junction tables
async function getLinkedIds(db, collectionName, fieldName) {
  const snapshot = await db.collection(collectionName).get();
  const ids = new Set();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data[fieldName]) {
      ids.add(data[fieldName]);
    }
  });
  return ids;
}

// Buscar drafts órfãos de uma coleção
async function findOrphanDrafts(db, collectionName, linkedIds, thresholdDate) {
  const snapshot = await db.collection(collectionName)
    .where('status', '==', 'DRAFT')
    .get();

  const orphans = [];
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    
    // Verificar se está vinculado
    const isLinked = linkedIds.has(id);
    
    // Verificar idade
    let createdAt = data.createdAt;
    if (createdAt && createdAt.toDate) {
      createdAt = createdAt.toDate();
    } else if (createdAt && typeof createdAt === 'string') {
      createdAt = new Date(createdAt);
    } else {
      createdAt = new Date(); // Se não tiver data, considerar como recente
    }
    
    const isOld = createdAt < thresholdDate;
    
    // É órfão se: é DRAFT + não está vinculado + é antigo
    if (!isLinked && isOld) {
      orphans.push({
        id,
        titulo: data.titulo || '(sem título)',
        createdAt,
        sessionId: data.createdInSessionId || null,
      });
    }
  });

  return orphans;
}

// Deletar documentos
async function deleteDocuments(db, collectionName, ids, dryRun) {
  if (ids.length === 0) return 0;
  
  if (dryRun) {
    console.log(`  [DRY-RUN] Deletaria ${ids.length} documento(s) de ${collectionName}`);
    return ids.length;
  }

  const batch = db.batch();
  let count = 0;

  for (const id of ids) {
    batch.delete(db.collection(collectionName).doc(id));
    count++;

    // Firestore tem limite de 500 operações por batch
    if (count % 500 === 0) {
      await batch.commit();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`  Deletados ${count} documento(s) de ${collectionName}`);
  return count;
}

// Função principal
async function cleanupOrphanDrafts() {
  const config = parseArgs();
  const db = initFirebase();
  const thresholdDate = getThresholdDate(config.days);

  console.log('\n=== CLEANUP DE DRAFTS ÓRFÃOS ===');
  console.log(`Modo: ${config.dryRun ? 'DRY-RUN (simulação)' : 'PRODUÇÃO'}`);
  console.log(`Dias para considerar órfão: ${config.days}`);
  console.log(`Data limite: ${thresholdDate.toISOString()}`);
  console.log('');

  let totalDeleted = 0;

  try {
    // 1. Buscar IDs vinculados em junction tables
    console.log('Buscando IDs vinculados...');
    
    const linkedCursoIds = await getLinkedIds(db, COLLECTIONS.TRILHA_CURSOS, 'cursoId');
    const linkedModuloIds = await getLinkedIds(db, COLLECTIONS.CURSO_MODULOS, 'moduloId');
    const linkedAulaIds = await getLinkedIds(db, COLLECTIONS.MODULO_AULAS, 'aulaId');
    
    console.log(`  Cursos vinculados: ${linkedCursoIds.size}`);
    console.log(`  Módulos vinculados: ${linkedModuloIds.size}`);
    console.log(`  Aulas vinculadas: ${linkedAulaIds.size}`);
    console.log('');

    // 2. Buscar e deletar aulas órfãs
    console.log('Verificando aulas órfãs...');
    const orphanAulas = await findOrphanDrafts(db, COLLECTIONS.AULAS, linkedAulaIds, thresholdDate);
    if (orphanAulas.length > 0) {
      console.log(`  Encontradas ${orphanAulas.length} aula(s) órfã(s):`);
      orphanAulas.forEach(a => console.log(`    - [${a.id}] ${a.titulo} (criado em ${a.createdAt.toISOString()})`));
      totalDeleted += await deleteDocuments(db, COLLECTIONS.AULAS, orphanAulas.map(a => a.id), config.dryRun);
    } else {
      console.log('  Nenhuma aula órfã encontrada.');
    }
    console.log('');

    // 3. Buscar e deletar módulos órfãos
    console.log('Verificando módulos órfãos...');
    const orphanModulos = await findOrphanDrafts(db, COLLECTIONS.MODULOS, linkedModuloIds, thresholdDate);
    if (orphanModulos.length > 0) {
      console.log(`  Encontrados ${orphanModulos.length} módulo(s) órfão(s):`);
      orphanModulos.forEach(m => console.log(`    - [${m.id}] ${m.titulo} (criado em ${m.createdAt.toISOString()})`));
      totalDeleted += await deleteDocuments(db, COLLECTIONS.MODULOS, orphanModulos.map(m => m.id), config.dryRun);
    } else {
      console.log('  Nenhum módulo órfão encontrado.');
    }
    console.log('');

    // 4. Buscar e deletar cursos órfãos
    console.log('Verificando cursos órfãos...');
    const orphanCursos = await findOrphanDrafts(db, COLLECTIONS.CURSOS, linkedCursoIds, thresholdDate);
    if (orphanCursos.length > 0) {
      console.log(`  Encontrados ${orphanCursos.length} curso(s) órfão(s):`);
      orphanCursos.forEach(c => console.log(`    - [${c.id}] ${c.titulo} (criado em ${c.createdAt.toISOString()})`));
      totalDeleted += await deleteDocuments(db, COLLECTIONS.CURSOS, orphanCursos.map(c => c.id), config.dryRun);
    } else {
      console.log('  Nenhum curso órfão encontrado.');
    }
    console.log('');

    // Nota: Trilhas geralmente não são órfãs (são a raiz da hierarquia)
    // Mas podemos verificar trilhas DRAFT sem cursos se necessário

    // Resumo
    console.log('=== RESUMO ===');
    console.log(`Total de drafts órfãos ${config.dryRun ? 'que seriam deletados' : 'deletados'}: ${totalDeleted}`);
    
    if (config.dryRun) {
      console.log('\nPara executar a limpeza real, remova a flag --dry-run');
    }

  } catch (error) {
    console.error('\nErro durante cleanup:', error);
    process.exit(1);
  }

  console.log('\nCleanup concluído.');
  process.exit(0);
}

// Executar
cleanupOrphanDrafts();
