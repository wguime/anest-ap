/**
 * Script para publicar todo o conteúdo educacional e corrigir relações.
 *
 * No console do navegador (F12) em localhost:5173:
 *
 *   const s = document.createElement('script'); s.type = 'module'; s.src = '/publish-all-educacao.js'; document.head.appendChild(s);
 */

(async () => {
  // Importar o service que já tem tudo do Firestore bundled pelo Vite
  const svc = await import('/src/services/educacaoService.js');

  console.log('%c=== PUBLICAR TODO CONTEÚDO EDUCACIONAL ===', 'font-size:16px;font-weight:bold');

  // 1. Ler dados usando funções do service
  console.log('\n1. Lendo dados...');
  const [
    { trilhas }, { cursos },
  ] = await Promise.all([
    svc.getTrilhas(),
    svc.getCursos(),
  ]);

  // Buscar módulos de cada curso
  const allModulos = [];
  for (const c of (cursos || [])) {
    const { modulos } = await svc.getModulosByCurso(c.id);
    if (modulos?.length) allModulos.push(...modulos);
  }
  // Dedup
  const modulosMap = new Map();
  allModulos.forEach(m => modulosMap.set(m.id, m));
  const modulos = Array.from(modulosMap.values());

  // Buscar aulas de cada módulo
  const allAulas = [];
  for (const m of modulos) {
    const { aulas } = await svc.getAulasByModulo(m.id);
    if (aulas?.length) allAulas.push(...aulas);
  }
  const aulasMap = new Map();
  allAulas.forEach(a => aulasMap.set(a.id, a));
  const aulas = Array.from(aulasMap.values());

  console.log(`   Trilhas: ${(trilhas||[]).length}, Cursos: ${(cursos||[]).length}, Módulos: ${modulos.length}, Aulas: ${aulas.length}`);

  // 2. Publicar cada item usando publishEntity (com cascade desligado para evitar loops)
  console.log('\n2. Publicando itens...');
  let pubCount = 0;

  for (const t of (trilhas || [])) {
    if (t.statusPublicacao !== 'published') {
      const r = await svc.publishEntity('trilha', t.id, { cascade: false, userId: 'admin-script' });
      pubCount++;
      console.log(`   Trilha "${t.titulo}": ${r.success ? 'OK' : r.errors}`);
    }
  }

  for (const c of (cursos || [])) {
    if (c.statusPublicacao !== 'published') {
      const r = await svc.publishEntity('curso', c.id, { cascade: false, userId: 'admin-script' });
      pubCount++;
      console.log(`   Curso "${c.titulo}": ${r.success ? 'OK' : r.errors}`);
    }
  }

  for (const m of modulos) {
    if (m.statusPublicacao !== 'published') {
      const r = await svc.publishEntity('modulo', m.id, { cascade: false, userId: 'admin-script' });
      pubCount++;
      console.log(`   Módulo "${m.titulo}": ${r.success ? 'OK' : r.errors}`);
    }
  }

  for (const a of aulas) {
    if (a.statusPublicacao !== 'published') {
      const r = await svc.publishEntity('aula', a.id, { cascade: false, userId: 'admin-script' });
      pubCount++;
      console.log(`   Aula "${a.titulo}": ${r.success ? 'OK' : r.errors}`);
    }
  }

  console.log(`   OK: ${pubCount} itens publicados`);

  // 3. Verificar e criar relações faltantes nas junction tables
  console.log('\n3. Verificando relações (junction tables)...');

  const { rels: allTC } = await svc.getAllTrilhaCursosRel();
  const { rels: allCM } = await svc.getAllCursoModulosRel();
  const { rels: allMA } = await svc.getAllModuloAulasRel();

  console.log(`   Relações existentes: T-C=${(allTC||[]).length}, C-M=${(allCM||[]).length}, M-A=${(allMA||[]).length}`);

  let relCount = 0;
  const existTC = new Set((allTC||[]).map(r => `${r.trilhaId}__${r.cursoId}`));
  const existCM = new Set((allCM||[]).map(r => `${r.cursoId}__${r.moduloId}`));
  const existMA = new Set((allMA||[]).map(r => `${r.moduloId}__${r.aulaId}`));

  // Trilha -> Cursos (do array embutido)
  for (const t of (trilhas || [])) {
    const cursoIds = t.cursos || [];
    for (let j = 0; j < cursoIds.length; j++) {
      const key = `${t.id}__${cursoIds[j]}`;
      if (!existTC.has(key)) {
        await svc.linkCursoToTrilha(t.id, cursoIds[j], j + 1, 'admin-script');
        existTC.add(key);
        relCount++;
        console.log(`   + T->C: "${t.titulo}" -> ${cursoIds[j]}`);
      }
    }
  }

  // Curso -> Módulos (do array embutido ou campo cursoId)
  for (const c of (cursos || [])) {
    let mIds = c.moduloIds || [];
    if (!mIds.length) {
      mIds = modulos.filter(m => m.cursoId === c.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(m => m.id);
    }
    for (let j = 0; j < mIds.length; j++) {
      const key = `${c.id}__${mIds[j]}`;
      if (!existCM.has(key)) {
        await svc.linkModuloToCurso(c.id, mIds[j], j + 1, 'admin-script');
        existCM.add(key);
        relCount++;
        console.log(`   + C->M: "${c.titulo}" -> ${mIds[j]}`);
      }
    }
  }

  // Módulo -> Aulas (do array embutido ou campo moduloId)
  for (const m of modulos) {
    let aIds = m.aulaIds || [];
    if (!aIds.length) {
      aIds = aulas.filter(a => a.moduloId === m.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(a => a.id);
    }
    for (let j = 0; j < aIds.length; j++) {
      const key = `${m.id}__${aIds[j]}`;
      if (!existMA.has(key)) {
        await svc.linkAulaToModulo(m.id, aIds[j], j + 1, 'admin-script');
        existMA.add(key);
        relCount++;
        console.log(`   + M->A: "${m.titulo}" -> ${aIds[j]}`);
      }
    }
  }
  console.log(`   OK: ${relCount} relações criadas`);

  // 4. Forçar sincronização dos arrays denormalizados
  console.log('\n4. Sincronizando arrays denormalizados...');
  // Re-fetch junction tables after step 3 created new rels
  const { rels: freshTC } = await svc.getAllTrilhaCursosRel();
  if (svc.syncTrilhaCursos || svc.backfillDenormalizedParents) {
    try {
      // Sync trilhas — pass cursoIds from junction table
      for (const t of (trilhas || [])) {
        if (svc.syncTrilhaCursos) {
          const tcRels = (freshTC || []).filter(r => r.trilhaId === t.id);
          const cursoIds = tcRels.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(r => r.cursoId);
          if (cursoIds.length) {
            await svc.syncTrilhaCursos(t.id, cursoIds, 'admin-script');
            console.log(`   Trilha "${t.titulo}": sincronizada (${cursoIds.length} cursos)`);
          }
        }
      }
      // Backfill denormalized parents
      if (svc.backfillDenormalizedParents) {
        const r = await svc.backfillDenormalizedParents({ dryRun: false });
        console.log(`   Backfill: ${r.modulesFixed} módulos, ${r.aulasFixed} aulas corrigidas`);
      }
    } catch (e) {
      console.warn('   Sync parcial:', e.message);
    }
  }
  console.log('   OK');

  console.log('\n%c=== CONCLUÍDO ===', 'font-size:16px;font-weight:bold;color:green');
  console.log(`Publicados: ${pubCount} | Relações: ${relCount}`);
  console.log('\nRecarregue a página Educação Continuada (F5) para ver o conteúdo!');
})();
