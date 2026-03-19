// ============================================================
// Parser de extratos CSV do Nubank
// Suporta: NuConta PF, NuConta PJ
// ============================================================

export interface ParsedTransaction {
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // positivo = receita, negativo = despesa
  type: 'income' | 'expense'
  raw: string
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  total: number
  errors: string[]
  detectedProfile: 'pf' | 'pj' | 'unknown'
}

// Nubank NuConta exporta CSV com este cabeçalho:
// Data,Valor,Identificador,Descrição
// 2024-01-15,-150.00,abc123,Mercado XYZ
//
// Formato alternativo mais antigo:
// date,title,amount
// 2024-01-15,Mercado XYZ,-150.00

export function parseNubankCSV(csvContent: string): ParseResult {
  const lines = csvContent.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const errors: string[] = []
  const transactions: ParsedTransaction[] = []

  if (lines.length < 2) {
    return { transactions: [], total: 0, errors: ['Arquivo vazio ou inválido'], detectedProfile: 'unknown' }
  }

  const header = lines[0].toLowerCase()
  let parser: ((line: string) => ParsedTransaction | null) | null = null

  // Detecta formato
  if (header.includes('data') && header.includes('valor') && header.includes('descrição') ||
      header.includes('data') && header.includes('valor') && header.includes('descri')) {
    // Formato: Data,Valor,Identificador,Descrição
    parser = parseNuContaFormat
  } else if (header.includes('date') && header.includes('title') && header.includes('amount')) {
    // Formato antigo: date,title,amount
    parser = parseNuContaOldFormat
  } else if (header.includes('data') && header.includes('descri') && header.includes('valor')) {
    parser = parseNuContaFormat
  } else {
    // Tenta inferir pelo conteúdo
    parser = parseGenericFormat
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    try {
      const tx = parser(line)
      if (tx) {
        transactions.push(tx)
      }
    } catch {
      errors.push(`Linha ${i + 1}: não foi possível processar "${line}"`)
    }
  }

  // Detecta PJ heurísticamente pelo conteúdo
  const pjKeywords = /cnpj|nota fiscal|nf-e|nfse|faturamento|pagamento pj|empresa|mei|simples|receita bruta/i
  const hasPjContent = transactions.some(t => pjKeywords.test(t.description))
  const detectedProfile = hasPjContent ? 'pj' : 'pf'

  return {
    transactions,
    total: transactions.length,
    errors,
    detectedProfile,
  }
}

// Formato atual NuConta: Data,Valor,Identificador,Descrição
function parseNuContaFormat(line: string): ParsedTransaction | null {
  const cols = splitCSVLine(line)
  if (cols.length < 3) return null

  // Tenta encontrar data, valor, descrição independente da ordem
  let dateStr = ''
  let amount = 0
  let description = ''

  for (const col of cols) {
    const clean = col.trim().replace(/"/g, '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      dateStr = clean
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/')
      dateStr = `${y}-${m}-${d}`
    } else if (/^-?\d+[.,]\d{2}$/.test(clean)) {
      amount = parseFloat(clean.replace(',', '.'))
    } else if (clean && !clean.match(/^[a-f0-9-]{8,}$/i) && isNaN(Number(clean))) {
      description = clean
    }
  }

  if (!dateStr || !description) return null

  return {
    date: dateStr,
    description,
    amount,
    type: amount >= 0 ? 'income' : 'expense',
    raw: line,
  }
}

// Formato antigo: date,title,amount
function parseNuContaOldFormat(line: string): ParsedTransaction | null {
  const cols = splitCSVLine(line)
  if (cols.length < 3) return null

  const dateRaw = cols[0].trim().replace(/"/g, '')
  const description = cols[1].trim().replace(/"/g, '')
  const amountRaw = cols[2].trim().replace(/"/g, '')

  let dateStr = dateRaw
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)) {
    const [d, m, y] = dateRaw.split('/')
    dateStr = `${y}-${m}-${d}`
  }

  const amount = parseFloat(amountRaw.replace(',', '.'))

  if (!dateStr || !description || isNaN(amount)) return null

  return {
    date: dateStr,
    description,
    amount,
    type: amount >= 0 ? 'income' : 'expense',
    raw: line,
  }
}

// Fallback genérico
function parseGenericFormat(line: string): ParsedTransaction | null {
  const cols = splitCSVLine(line)
  if (cols.length < 2) return null

  let dateStr = ''
  let amount = 0
  let description = ''

  for (const col of cols) {
    const clean = col.trim().replace(/"/g, '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      dateStr = clean
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/')
      dateStr = `${y}-${m}-${d}`
    } else if (/^-?\d+([.,]\d{1,2})?$/.test(clean.replace('R$', '').trim())) {
      amount = parseFloat(clean.replace('R$', '').replace(',', '.').trim())
    } else if (clean.length > 2) {
      description = clean
    }
  }

  if (!description) return null
  if (!dateStr) dateStr = new Date().toISOString().split('T')[0]

  return {
    date: dateStr,
    description,
    amount,
    type: amount >= 0 ? 'income' : 'expense',
    raw: line,
  }
}

// Divide linha CSV respeitando campos com vírgula dentro de aspas
function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
