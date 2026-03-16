/**
 * Migração: Adicionar campos published*Ids
 * 
 * IMPORTANTE: Executar ANTES de deployar Firestore rules
 * 
 * Este script:
 * 1. Adiciona publishedAulaIds a todos os módulos
 * 2. Adiciona publishedModuloIds a todos os cursos
 * 3. Adiciona publishedCursoIds a todas as trilhas
 * 
 * Após executar este script, chamar recomputeAllPublishedChildren()
 * no Admin UI para popular os arrays.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Verificar se serviceAccountKey.json existe
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Erro: serviceAccountKey.json não encontrado');
  console.log('📥 Baixe o arquivo do Firebase Console:');
  console.log('   Project Settings > Service Accounts > Generate New Private Key');
  console.log(`   Salve em: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Função principal de migração
 */
async function migrate() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Migração: Student-Safe Architecture                    ║');
  console.log('║   Adicionar campos published*Ids                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  let totalUpdates = 0;
  
  try {
    // ========================================
    // 1. MÓDULOS - Adicionar publishedAulaIds
    // ========================================
    console.log('📁 Atualizando módulos...');
    const modulosSnap = await db.collection('educacao_modulos').get();
    
    if (modulosSnap.size === 0) {
      console.log('   ⚠️  Nenhum módulo encontrado');
    } else {
      // Batch updates (max 400 por batch para margem de segurança)
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      
      modulosSnap.docs.forEach((doc, index) => {
        currentBatch.update(doc.ref, {
          publishedAulaIds: [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        batchCount++;
        totalUpdates++;
        
        // Commit batch a cada 400 writes (margem de segurança)
        if (batchCount >= 400 || index === modulosSnap.size - 1) {
          batches.push(currentBatch.commit());
          currentBatch = db.batch();
          batchCount = 0;
        }
      });
      
      await Promise.all(batches);
      console.log(`   ✅ ${modulosSnap.size} módulos atualizados`);
    }
    
    // ========================================
    // 2. CURSOS - Adicionar publishedModuloIds
    // ========================================
    console.log('📚 Atualizando cursos...');
    const cursosSnap = await db.collection('educacao_cursos').get();
    
    if (cursosSnap.size === 0) {
      console.log('   ⚠️  Nenhum curso encontrado');
    } else {
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      
      cursosSnap.docs.forEach((doc, index) => {
        currentBatch.update(doc.ref, {
          publishedModuloIds: [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        batchCount++;
        totalUpdates++;
        
        if (batchCount >= 400 || index === cursosSnap.size - 1) {
          batches.push(currentBatch.commit());
          currentBatch = db.batch();
          batchCount = 0;
        }
      });
      
      await Promise.all(batches);
      console.log(`   ✅ ${cursosSnap.size} cursos atualizados`);
    }
    
    // ========================================
    // 3. TRILHAS - Adicionar publishedCursoIds
    // ========================================
    console.log('🎓 Atualizando trilhas...');
    const trilhasSnap = await db.collection('educacao_trilhas').get();
    
    if (trilhasSnap.size === 0) {
      console.log('   ⚠️  Nenhuma trilha encontrada');
    } else {
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      
      trilhasSnap.docs.forEach((doc, index) => {
        currentBatch.update(doc.ref, {
          publishedCursoIds: [],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        batchCount++;
        totalUpdates++;
        
        if (batchCount >= 400 || index === trilhasSnap.size - 1) {
          batches.push(currentBatch.commit());
          currentBatch = db.batch();
          batchCount = 0;
        }
      });
      
      await Promise.all(batches);
      console.log(`   ✅ ${trilhasSnap.size} trilhas atualizadas`);
    }
    
    // ========================================
    // RESUMO
    // ========================================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ Migração concluída!');
    console.log(`   📊 Total de updates: ${totalUpdates}`);
    console.log(`   ⏱️  Tempo: ${elapsed}s`);
    console.log('\n🔄 PRÓXIMO PASSO:');
    console.log('   Execute recomputeAllPublishedChildren() no Admin UI para popular arrays');
    console.log('   Ou via Firebase Console: Cloud Functions > recomputeAllPublishedChildren');
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   Migração Concluída com Sucesso!                        ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Erro durante migração:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Validação pré-migração
 */
async function validateBeforeMigration() {
  console.log('🔍 Validando ambiente...\n');
  
  try {
    // Testar conexão Firestore
    const testDoc = await db.collection('educacao_trilhas').limit(1).get();
    console.log('   ✅ Conexão Firestore OK');
    
    // Verificar se já foi migrado
    if (testDoc.size > 0) {
      const firstDoc = testDoc.docs[0];
      if (firstDoc.data().hasOwnProperty('publishedCursoIds')) {
        console.log('   ⚠️  Campo publishedCursoIds já existe');
        console.log('   Este script já foi executado? Continue? (Ctrl+C para cancelar)');
        
        // Aguardar 5 segundos
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return true;
  } catch (error) {
    console.error('   ❌ Erro de validação:', error.message);
    return false;
  }
}

/**
 * Main
 */
async function main() {
  const isValid = await validateBeforeMigration();
  
  if (!isValid) {
    console.error('❌ Validação falhou. Abortando migração.');
    process.exit(1);
  }
  
  console.log('');
  await migrate();
}

// Executar
main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
