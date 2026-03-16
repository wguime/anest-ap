import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://anest-ap.web.app'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `Voce e um assistente medico especialista em anestesiologia, vinculado ao programa de Residencia Medica. Sua base de conhecimento e o Tratado de Anestesiologia da SAESP (10a edicao).

REGRAS:
1. Responda SEMPRE em portugues brasileiro.
2. Baseie suas respostas EXCLUSIVAMENTE no contexto fornecido.
3. Se a informacao NAO estiver no contexto, diga: "Nao encontrei essa informacao nos documentos da SAESP."
4. NUNCA invente dosagens, protocolos ou condutas.
5. Referencie fontes entre colchetes: [1], [2].
6. Formate com topicos e listas quando apropriado.
7. Este e um assistente educacional — para emergencias, consulte protocolos oficiais.`

// ---------- Embedding ----------

async function getEmbedding(text: string): Promise<number[]> {
  // Try Voyage AI first (free tier)
  const voyageKey = Deno.env.get('VOYAGE_API_KEY')
  if (voyageKey) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voyageKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voyage-3-lite',
        input: [text],
        input_type: 'query',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.data[0].embedding
    }
    console.error('Voyage AI embedding failed, falling back to OpenAI:', await res.text())
  }

  // Fallback: OpenAI embedding
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) throw new Error('No embedding API key configured (VOYAGE_API_KEY or OPENAI_API_KEY)')

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI embedding failed: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

// ---------- LLM ----------

async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  stream: boolean = false,
): Promise<Response | string> {
  const groqKey = Deno.env.get('GROQ_API_KEY')

  // Primary: Groq (Llama 3.3 70B)
  if (groqKey) {
    const payload = {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 2048,
      messages,
      stream,
    }
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      if (stream) return res
      const data = await res.json()
      return data.choices[0].message.content
    }
    console.error('Groq failed, trying Gemini fallback:', res.status)
  }

  // Fallback: Google Gemini 2.5 Flash (free tier)
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (geminiKey) {
    // Convert OpenAI-style messages to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system')?.content || ''
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      },
    )
    if (res.ok) {
      const data = await res.json()
      return data.candidates[0].content.parts[0].text
    }
    console.error('Gemini fallback also failed:', res.status)
  }

  throw new Error('No LLM API available (GROQ_API_KEY or GEMINI_API_KEY required)')
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, history = [], stream = false } = await req.json()
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "query" in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Contextual query for embedding (resolve pronouns from history)
    let embeddingQuery = query
    if (history.length > 0) {
      const lastExchange = history
        .slice(-2)
        .map((m: { content: string }) => m.content.slice(0, 200))
        .join(' ')
      embeddingQuery = `${lastExchange} ${query}`
    }

    // Generate embedding
    const queryEmbedding = await getEmbedding(embeddingQuery)

    // Retrieve documents — try hybrid_search first, fallback to match_documents
    let documents: Array<{ id: number; content: string; similarity: number }> | null = null

    const { data: hybridDocs, error: hybridError } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_threshold: 0.55,
      match_count: 8,
    })

    if (!hybridError && hybridDocs?.length > 0) {
      documents = hybridDocs
    } else {
      // Fallback to vector-only search
      const { data: vectorDocs, error: matchError } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.55,
        match_count: 8,
      })
      if (matchError) {
        throw new Error(`match_documents RPC failed: ${matchError.message}`)
      }
      documents = vectorDocs
    }

    // Build context from retrieved documents
    const context = (documents ?? [])
      .map((doc, i: number) => `[${i + 1}] ${doc.content}`)
      .join('\n\n')

    // Build LLM messages with history
    const llmMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, 1000),
      })),
      { role: 'user', content: `Contexto dos documentos:\n${context}\n\nPergunta: ${query}` },
    ]

    // --- Streaming mode ---
    if (stream) {
      const streamRes = await chatCompletion(llmMessages, true)
      if (typeof streamRes === 'string') {
        // Fallback returned string instead of stream
        const payload = JSON.stringify({
          answer: streamRes,
          sources: (documents ?? []).map((doc) => ({
            content: doc.content.length > 200 ? doc.content.slice(0, 200) + '...' : doc.content,
            similarity: doc.similarity,
          })),
        })
        return new Response(payload, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // SSE stream from Groq
      const reader = (streamRes as Response).body!.getReader()
      const decoder = new TextDecoder()
      const sources = (documents ?? []).map((doc) => ({
        content: doc.content.length > 200 ? doc.content.slice(0, 200) + '...' : doc.content,
        similarity: doc.similarity,
      }))

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          let buffer = ''

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue
                const payload = line.slice(6).trim()
                if (payload === '[DONE]') continue

                try {
                  const parsed = JSON.parse(payload)
                  const delta = parsed.choices?.[0]?.delta?.content
                  if (delta) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`))
                  }
                } catch {
                  // skip malformed chunks
                }
              }
            }

            // Send sources at the end
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`),
            )
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (err) {
            controller.error(err)
          }
        },
      })

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // --- Non-streaming mode ---
    const answer = await chatCompletion(llmMessages)

    const sources = (documents ?? []).map((doc) => ({
      content: doc.content.length > 200 ? doc.content.slice(0, 200) + '...' : doc.content,
      similarity: doc.similarity,
    }))

    return new Response(
      JSON.stringify({ answer, sources }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('ai-rag error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
