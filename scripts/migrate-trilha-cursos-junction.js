/**
 * migrate-trilha-cursos-junction.js
 * Script para migrar de Trilha.cursos[] (array) para junction table educacao_trilha_cursos
 * 
 * O modelo antigo armazenava cursos como array na trilha:
 *   trilha.cursos = ['cursoId1', 'cursoId2', ...]
 * 
 * O novo modelo usa junction table N:N:
 *   educacao_trilha_cursos/{trilhaId_cursoId}
 *   { trilhaId, cursoId, ordem, createdAt, updatedAt, createdBy }
 * 
 * Uso:
 *   node scripts/migrate-trilha-cursos-junction.js [--dry-run] [--remove-old]
 * 
 * Opções:
 *   --dry-run     Apenas mostra o que seria feito, sem executar
 *   --remove-old  Remove o campo cursos[] das trilhas após migração
 * 
 * Requisitos:
 *   - serviceAccountKey.json na pasta scripts/
 */

const admin = require('firebase-admin');
const path = require('path');

// Configuração
const COLLECTIONS = {
  TRILHAS: 'educacao_trilhas',
  CURSOS: 'educacao_cursos',
  TRILHA_CURSOS: 'educacao_trilha_cursos',
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
    removeOld: false,
  };

  args.forEach(arg => {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--remove-old') {
      config.removeOld = true;
    }
  });

  return config;
}

// Gerar ID composto para a junction table
function getJunctionId(trilhaId, cursoId) {
  return `${trilhaId}_${cursoId}`;
}

// Verificar se relação já existe na junction table
async function relationExists(db, trilhaId, cursoId) {
  const docId = getJunctionId(trilhaId, cursoId);
  const doc = await db.collection(COLLECTIONS.TRILHA_CURSOS).doc(docId).get();
  return doc.exists;
}

// Criar relação na junction table
async function createRelation(db, trilhaId, cursoId, ordem, dryRun) {
  const docId = getJunctionId(trilhaId, cursoId);
  
  if (dryRun) {
    console.log(`    [DRY-RUN] Criaria relação: ${docId} (ordem: ${ordem})`);
    return true;
  }

  const data = {
    trilhaId,
    cursoId,
    ordem,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'migration-script',
  };

  await db.collection(COLLECTIONS.TRILHA_CURSOS).doc(docId).set(data);
  return true;
}

// Remover campo cursos[] da trilha
async function removeOldField(db, trilhaId, dryRun) {
  if (dryRun) {
    console.log(`    [DRY-RUN] Removeria campo cursos[] da trilha ${trilhaId}`);
    return;
  }

  await db.collection(COLLECTIONS.TRILHAS).doc(trilhaId).update({
    cursos: admin.firestore.FieldValue.delete(),
    _migratedToJunction: true,
    _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Função principal de migração
async function migrateTrilhaCursos() {
  const config = parseArgs();
  const db = initFirebase();

  console.log('\n=== MIGRAÇÃO: Trilha.cursos[] → Junction Table ===');
  console.log(`Modo: ${config.dryRun ? 'DRY-RUN (simulação)' : 'PRODUÇÃO'}`);
  console.log(`Remover campo antigo: ${config.removeOld ? 'SIM' : 'NÃO'}`);
  console.log('');

  try {
    // 1. Buscar todas as trilhas
    console.log('Buscando trilhas...');
    const trilhasSnapshot = await db.collection(COLLECTIONS.TRILHAS).get();
    const trilhas = trilhasSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log(`  Encontradas ${trilhas.length} trilha(s)`);
    console.log('');

    // 2. Buscar cursos existentes para validação
    console.log('Buscando cursos para validação...');
    const cursosSnapshot = await db.collection(COLLECTIONS.CURSOS).get();
    const cursosExistentes = new Set(cursosSnapshot.docs.map(doc => doc.id));
    console.log(`  Encontrados ${cursosExistentes.size} curso(s)`);
    console.log('');

    // Estatísticas
    let totalRelacoes = 0;
    let relacionesCriadas = 0;
    let relacionesExistentes = 0;
    let cursosInvalidos = 0;
    let trilhasMigradas = 0;

    // 3. Processar cada trilha
    for (const trilha of trilhas) {
      const cursos = trilha.cursos || [];
      
      if (cursos.length === 0) {
        console.log(`Trilha [${trilha.id}] ${trilha.titulo}: nenhum curso vinculado`);
        continue;
      }

      console.log(`Trilha [${trilha.id}] ${trilha.titulo}: ${cursos.length} curso(s)`);
      trilhasMigradas++;

      for (let i = 0; i < cursos.length; i++) {
        const cursoId = cursos[i];
        const ordem = i + 1;
        totalRelacoes++;

        // Validar se curso existe
        if (!cursosExistentes.has(cursoId)) {
          console.log(`    ⚠️ Curso ${cursoId} não encontrado (pulando)`);
          cursosInvalidos++;
          continue;
        }

        // Verificar se relação já existe
        const exists = await relationExists(db, trilha.id, cursoId);
        
        if (exists) {
          console.log(`    ✓ Relação já existe: ${trilha.id} → ${cursoId}`);
          relacionesExistentes++;
        } else {
          // Criar relação
          await createRelation(db, trilha.id, cursoId, ordem, config.dryRun);
          if (!config.dryRun) {
            console.log(`    + Criada relação: ${trilha.id} → ${cursoId} (ordem: ${ordem})`);
          }
          relacionesCriadas++;
        }
      }

      // Remover campo antigo se solicitado
      if (config.removeOld) {
        await removeOldField(db, trilha.id, config.dryRun);
        if (!config.dryRun) {
          console.log(`    - Removido campo cursos[] da trilha`);
        }
      }

      console.log('');
    }

    // 4. Resumo
    console.log('=== RESUMO DA MIGRAÇÃO ===');
    console.log(`Trilhas processadas: ${trilhasMigradas}`);
    console.log(`Total de relações no modelo antigo: ${totalRelacoes}`);
    console.log(`Relações já existentes na junction: ${relacionesExistentes}`);
    console.log(`Relações ${config.dryRun ? 'que seriam criadas' : 'criadas'}: ${relacionesCriadas}`);
    console.log(`Cursos inválidos (não encontrados): ${cursosInvalidos}`);

    if (config.dryRun) {
      console.log('\nPara executar a migração real, remova a flag --dry-run');
      if (!config.removeOld) {
        console.log('Adicione --remove-old para remover o campo cursos[] após migração');
      }
    }

    // Verificação pós-migração
    if (!config.dryRun) {
      console.log('\n=== VERIFICAÇÃO PÓS-MIGRAÇÃO ===');
      const junctionSnapshot = await db.collection(COLLECTIONS.TRILHA_CURSOS).get();
      console.log(`Total de relações na junction table: ${junctionSnapshot.size}`);
    }

  } catch (error) {
    console.error('\nErro durante migração:', error);
    process.exit(1);
  }

  console.log('\nMigração concluída.');
  process.exit(0);
}

// Executar
migrateTrilhaCursos();
