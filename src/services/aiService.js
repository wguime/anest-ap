import supabase, { getSupabaseToken } from '../config/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Ask a medical question using RAG (Supabase Edge Function + SAESP vector store)
 */
export async function askMedicalQuestion(query, history = []) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-rag', {
      body: { query, history }
    })
    if (error) {
      console.error('Erro ao consultar IA:', error)
      return { answer: null, sources: [], error: error.message || 'Erro ao consultar assistente médico' }
    }
    return { answer: data.answer, sources: data.sources || [], error: null }
  } catch (err) {
    console.error('Erro ao consultar IA:', err)
    return { answer: null, sources: [], error: err.message }
  }
}

/**
 * Ask a medical question with streaming response (SSE)
 * @param {string} query - The user's question
 * @param {Array} history - Conversation history [{role, content}]
 * @param {function} onChunk - Called with each text chunk as it arrives
 * @returns {{ answer: string, sources: Array, error: string|null }}
 */
export async function askMedicalQuestionStream(query, history = [], onChunk) {
  try {
    // Get custom JWT token (Firebase UID signed with Supabase secret)
    const token = await getSupabaseToken() || supabaseAnonKey

    const res = await fetch(`${supabaseUrl}/functions/v1/ai-rag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ query, history, stream: true }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }))
      return { answer: null, sources: [], error: errData.error || 'Erro ao consultar assistente médico' }
    }

    const contentType = res.headers.get('content-type') || ''

    // If server fell back to JSON (e.g. Gemini fallback)
    if (contentType.includes('application/json')) {
      const data = await res.json()
      if (onChunk) onChunk(data.answer)
      return { answer: data.answer, sources: data.sources || [], error: null }
    }

    // Parse SSE stream
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let answer = ''
    let sources = []
    let buffer = ''

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
          if (parsed.type === 'chunk' && parsed.content) {
            answer += parsed.content
            if (onChunk) onChunk(parsed.content)
          } else if (parsed.type === 'sources') {
            sources = parsed.sources || []
          }
        } catch {
          // skip malformed
        }
      }
    }

    return { answer, sources, error: null }
  } catch (err) {
    console.error('Erro ao consultar IA (stream):', err)
    return { answer: null, sources: [], error: err.message }
  }
}

/**
 * Parse natural language date in Portuguese
 * Handles: "hoje", "amanha", "ontem", weekday names, "dia 15", "15/02", "15 de fevereiro", "proxima segunda"
 * Returns Date object or null
 */
export function parseNaturalDate(text) {
  if (!text || typeof text !== 'string') return null

  const input = text.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // "hoje"
  if (input === 'hoje') {
    return new Date(today)
  }

  // "amanha"
  if (input === 'amanha') {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d
  }

  // "ontem"
  if (input === 'ontem') {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return d
  }

  // Weekday names (with optional "proxima" prefix)
  const weekdays = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6
  }

  // "proxima segunda", "segunda", "segunda-feira", etc.
  const weekdayPattern = /^(?:proxima?\s+)?(\w+?)(?:-feira)?$/
  const weekdayMatch = input.match(weekdayPattern)
  if (weekdayMatch) {
    const dayName = weekdayMatch[1]
    if (dayName in weekdays) {
      const target = weekdays[dayName]
      const current = today.getDay()
      let diff = target - current
      if (diff <= 0) diff += 7
      const d = new Date(today)
      d.setDate(d.getDate() + diff)
      return d
    }
  }

  // Month names in Portuguese (accent-stripped)
  const months = {
    janeiro: 0, jan: 0,
    fevereiro: 1, fev: 1,
    marco: 2, mar: 2,
    abril: 3, abr: 3,
    maio: 4, mai: 4,
    junho: 5, jun: 5,
    julho: 6, jul: 6,
    agosto: 7, ago: 7,
    setembro: 8, set: 8,
    outubro: 9, out: 9,
    novembro: 10, nov: 10,
    dezembro: 11, dez: 11
  }

  // "15 de fevereiro" / "15 de fev"
  const dayMonthNamePattern = /^(\d{1,2})\s+de\s+(\w+)$/
  const dayMonthNameMatch = input.match(dayMonthNamePattern)
  if (dayMonthNameMatch) {
    const day = parseInt(dayMonthNameMatch[1], 10)
    const monthName = dayMonthNameMatch[2]
    if (monthName in months) {
      const month = months[monthName]
      const d = new Date(today.getFullYear(), month, day)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }

  // "15/02" (DD/MM)
  const ddmmPattern = /^(\d{1,2})\/(\d{1,2})$/
  const ddmmMatch = input.match(ddmmPattern)
  if (ddmmMatch) {
    const day = parseInt(ddmmMatch[1], 10)
    const month = parseInt(ddmmMatch[2], 10) - 1
    const d = new Date(today.getFullYear(), month, day)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // "dia 15"
  const diaPattern = /^dia\s+(\d{1,2})$/
  const diaMatch = input.match(diaPattern)
  if (diaMatch) {
    const day = parseInt(diaMatch[1], 10)
    const d = new Date(today.getFullYear(), today.getMonth(), day)
    d.setHours(0, 0, 0, 0)
    // If that date is in the past, use next month
    if (d < today) {
      d.setMonth(d.getMonth() + 1)
    }
    return d
  }

  return null
}
