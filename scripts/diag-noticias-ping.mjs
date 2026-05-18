/**
 * READ-ONLY ping: testa se a Edge Function fetch-noticias está VIVA sem invocá-la
 * via OPTIONS preflight (não escreve dados). Também testa GET (não autorizado).
 */
const SUPABASE_URL = 'https://vjzrahruvjffyyqyhjny.supabase.co'

console.log('1) OPTIONS preflight (CORS):')
const optR = await fetch(`${SUPABASE_URL}/functions/v1/fetch-noticias`, {
  method: 'OPTIONS',
  headers: { 'Access-Control-Request-Method': 'POST' },
})
console.log(`   HTTP ${optR.status}  (esperado: 200)`)

console.log('\n2) GET sem auth:')
const getR = await fetch(`${SUPABASE_URL}/functions/v1/fetch-noticias`, { method: 'GET' })
console.log(`   HTTP ${getR.status}  body: ${(await getR.text()).slice(0, 200)}`)

console.log('\n3) POST sem auth:')
const postR = await fetch(`${SUPABASE_URL}/functions/v1/fetch-noticias`, {
  method: 'POST',
  body: '{}',
  headers: { 'Content-Type': 'application/json' },
})
console.log(`   HTTP ${postR.status}  body: ${(await postR.text()).slice(0, 300)}`)
