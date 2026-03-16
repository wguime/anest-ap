#!/usr/bin/env node
/**
 * Re-embed all SAESP chunks using Voyage AI (voyage-3-lite, 512 dimensions).
 *
 * Usage:
 *   VOYAGE_API_KEY=pa-... \
 *   SUPABASE_URL=https://vjzrahruvjffyyqyhjny.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/reembed-saesp.mjs
 *
 * Before running, apply migration 009_vector_512.sql to change column dimension.
 *
 * The script:
 * 1. Fetches all rows from saesp_pdf
 * 2. Batches them (max 128 per API call)
 * 3. Calls Voyage AI embedding API
 * 4. Updates each row's embedding in Supabase
 * 5. Logs progress
 */

import { createClient } from '@supabase/supabase-js'

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!VOYAGE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: VOYAGE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BATCH_SIZE = 128
const DELAY_MS = 500 // rate-limit safety

async function getVoyageEmbeddings(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-3-lite',
      input: texts,
      input_type: 'document',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Voyage AI API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data.data.map(d => d.embedding)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('Fetching all saesp_pdf rows...')

  // Fetch all rows (id + content)
  const { data: rows, error } = await supabase
    .from('saesp_pdf')
    .select('id, content')
    .order('id')

  if (error) {
    console.error('Failed to fetch rows:', error.message)
    process.exit(1)
  }

  console.log(`Found ${rows.length} chunks to re-embed.`)

  let processed = 0
  let failed = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const texts = batch.map(r => r.content || '')

    try {
      const embeddings = await getVoyageEmbeddings(texts)

      // Update each row
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabase
          .from('saesp_pdf')
          .update({ embedding: embeddings[j] })
          .eq('id', batch[j].id)

        if (updateError) {
          console.error(`  Failed to update row ${batch[j].id}:`, updateError.message)
          failed++
        } else {
          processed++
        }
      }

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedded ${batch.length} chunks (${processed}/${rows.length} total)`)
    } catch (err) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err.message)
      failed += batch.length
    }

    // Rate limit
    if (i + BATCH_SIZE < rows.length) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}, Total: ${rows.length}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
