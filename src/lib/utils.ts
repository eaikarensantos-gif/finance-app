import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "MMMM 'de' yyyy", { locale: ptBR })
}

export function getMonthRange(date = new Date()) {
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}

export function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    return {
      label: format(date, 'MMM', { locale: ptBR }),
      start: format(startOfMonth(date), 'yyyy-MM-dd'),
      end: format(endOfMonth(date), 'yyyy-MM-dd'),
    }
  })
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit: 'Cartão de Crédito',
  cash: 'Dinheiro',
  investment: 'Investimento',
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
}

// Parser de mensagens do WhatsApp
export function parseWhatsAppMessage(text: string): {
  type: 'income' | 'expense' | 'summary' | 'help' | 'unknown'
  amount?: number
  description?: string
  category?: string
} {
  const lower = text.toLowerCase().trim()

  // Comandos de resumo
  if (/^(resumo|saldo|balanço|extrato)/.test(lower)) {
    return { type: 'summary' }
  }

  // Ajuda
  if (/^(ajuda|help|\?)/.test(lower)) {
    return { type: 'help' }
  }

  // Receita: "recebi 500", "ganhei 1000 de salário", "entrada 200"
  const incomeMatch = lower.match(
    /^(recebi|ganhei|entrada|receita|renda)\s+r?\$?\s*([\d.,]+)(?:\s+(?:de|no|na|em)?\s*(.+))?/
  )
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[2].replace(',', '.'))
    return { type: 'income', amount, description: incomeMatch[3] || 'Receita' }
  }

  // Despesa: "gastei 50 no mercado", "paguei 100 de luz", "despesa 30"
  const expenseMatch = lower.match(
    /^(gastei|paguei|gasto|despesa|saiu|comprei)\s+r?\$?\s*([\d.,]+)(?:\s+(?:de|no|na|em|com|pra)?\s*(.+))?/
  )
  if (expenseMatch) {
    const amount = parseFloat(expenseMatch[2].replace(',', '.'))
    return { type: 'expense', amount, description: expenseMatch[3] || 'Despesa' }
  }

  // Formato simples: "mercado 50" ou "50 mercado"
  const simpleMatch = lower.match(/^(.+?)\s+r?\$?\s*([\d.,]+)$|^r?\$?\s*([\d.,]+)\s+(.+)$/)
  if (simpleMatch) {
    const amount = parseFloat((simpleMatch[2] || simpleMatch[3]).replace(',', '.'))
    const desc = simpleMatch[1] || simpleMatch[4]
    return { type: 'expense', amount, description: desc }
  }

  return { type: 'unknown' }
}

// Mapeia descrição para categoria (heurística simples)
export function detectPaymentMethod(description: string): string {
  const lower = description.toLowerCase()
  if (/\bpix\b|transferência|ted\b|doc\b/.test(lower)) return 'pix'
  if (/crédito|credito|cartão cred|parcel/.test(lower)) return 'credit'
  if (/débito|debito|cartão deb/.test(lower)) return 'debit'
  if (/saque|espécie|dinheiro/.test(lower)) return 'cash'
  return 'other'
}

export function paymentMethodLabel(method: string | null): string {
  const labels: Record<string, string> = {
    pix: 'PIX',
    credit: 'Cartão de Crédito',
    debit: 'Cartão de Débito',
    cash: 'Dinheiro',
    other: 'Outro',
  }
  return labels[method ?? 'other'] ?? 'Outro'
}

// Remove prefixos verbosos de extratos bancários deixando só o essencial
export function cleanDescription(description: string): string {
  let clean = description

  // Remove prefixos comuns de extratos Nubank/bancários
  const prefixes = [
    /^Transferência enviada pelo Pix\s*-\s*/i,
    /^Transferência recebida pelo Pix\s*-\s*/i,
    /^Pix enviado\s*-\s*/i,
    /^Pix recebido\s*-\s*/i,
    /^Compra no débito\s*-\s*/i,
    /^Compra no crédito\s*-\s*/i,
    /^Compra por aproximação\s*-\s*/i,
    /^Pagamento de boleto efetuado\s*-\s*/i,
    /^Pagamento efetuado\s*-\s*/i,
    /^Pagamento realizado\s*-\s*/i,
    /^Débito automático\s*-\s*/i,
    /^Transferência\s*-\s*/i,
  ]

  for (const prefix of prefixes) {
    if (prefix.test(clean)) {
      clean = clean.replace(prefix, '')
      break
    }
  }

  // Remove CPF mascarado e dados bancários: " - •••.XXX.XXX-•• - BANCO..."
  clean = clean.replace(/\s*-\s*[•\*]{3}\.[\d•\*]+\.[\d•\*]+-[•\*]{2}.*$/s, '')

  // Remove sufixos como "(Transferência enviada)", "(Transferência recebida)"
  clean = clean.replace(/\s*\([^)]*transferência[^)]*\)\s*$/i, '')
  clean = clean.replace(/\s*\([^)]*pix[^)]*\)\s*$/i, '')

  return clean.trim()
}

export function guessCategory(description: string): string {
  const lower = description.toLowerCase()
  if (/mercado|supermercado|feira|hortifruti/.test(lower)) return 'Supermercado'
  if (/restaurante|lanche|comida|almoço|janta|café|pizza|hamburguer/.test(lower)) return 'Alimentação'
  if (/uber|99|ônibus|metrô|gasolina|combustível|estacionamento/.test(lower)) return 'Transporte'
  if (/luz|energia|água|internet|telefone|plano/.test(lower)) return 'Moradia'
  if (/netflix|spotify|amazon|prime|disney|assinatura/.test(lower)) return 'Assinaturas'
  if (/médico|farmácia|remédio|consulta|hospital/.test(lower)) return 'Saúde'
  if (/curso|escola|faculdade|livro/.test(lower)) return 'Educação'
  if (/roupa|tênis|sapato|calça|camisa/.test(lower)) return 'Roupas'
  if (/salário|pagamento|freelance/.test(lower)) return 'Salário'
  return 'Outros (despesa)'
}
