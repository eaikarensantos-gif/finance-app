import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { parseWhatsAppMessage, guessCategory, getMonthRange, formatCurrency } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    // Verificar secret
    const secret = req.headers.get('x-bot-secret')
    if (secret !== process.env.WHATSAPP_BOT_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { from, message } = body // from = número WhatsApp, message = texto

    if (!from || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Busca usuário pelo número de WhatsApp
    const { data: settings } = await supabase
      .from('user_settings')
      .select('user_id, default_account_id')
      .eq('whatsapp_number', from)
      .single()

    if (!settings) {
      return NextResponse.json({
        reply: '❌ Número não cadastrado. Acesse o app e configure seu número em Configurações.'
      })
    }

    const { user_id, default_account_id } = settings
    const parsed = parseWhatsAppMessage(message)

    // Resumo do mês
    if (parsed.type === 'summary') {
      const { start, end } = getMonthRange()
      const { data: txs } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', user_id)
        .gte('date', start)
        .lte('date', end)

      const income = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = (txs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

      const { data: accounts } = await supabase
        .from('accounts')
        .select('balance')
        .eq('user_id', user_id)
      const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0)

      return NextResponse.json({
        reply: `📊 *Resumo de ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}*\n\n` +
          `✅ Receitas: ${formatCurrency(income)}\n` +
          `❌ Despesas: ${formatCurrency(expense)}\n` +
          `💰 Saldo do mês: ${formatCurrency(income - expense)}\n` +
          `🏦 Patrimônio total: ${formatCurrency(totalBalance)}`
      })
    }

    // Ajuda
    if (parsed.type === 'help') {
      return NextResponse.json({
        reply: `🤖 *Comandos disponíveis:*\n\n` +
          `💸 *Registrar despesa:*\n` +
          `  gastei 50 no mercado\n` +
          `  paguei 100 de luz\n` +
          `  mercado 35\n\n` +
          `💰 *Registrar receita:*\n` +
          `  recebi 3000 de salário\n` +
          `  ganhei 500 de freelance\n\n` +
          `📊 *Ver resumo:*\n` +
          `  resumo\n` +
          `  saldo\n\n` +
          `❓ *Ajuda:* ajuda`
      })
    }

    // Transação
    if ((parsed.type === 'income' || parsed.type === 'expense') && parsed.amount) {
      const guessed = guessCategory(parsed.description ?? '')

      // Busca categoria pelo nome
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .or(`user_id.eq.${user_id},is_default.eq.true`)

      const category = categories?.find(c =>
        c.name.toLowerCase() === guessed.toLowerCase()
      )

      const today = new Date().toISOString().split('T')[0]

      await supabase.from('transactions').insert({
        user_id,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description ?? (parsed.type === 'income' ? 'Receita' : 'Despesa'),
        date: today,
        category_id: category?.id ?? null,
        account_id: default_account_id ?? null,
        source: 'whatsapp',
      })

      // Atualiza saldo da conta padrão
      if (default_account_id) {
        const { data: acc } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', default_account_id)
          .single()

        if (acc) {
          const delta = parsed.type === 'income' ? parsed.amount : -parsed.amount
          await supabase
            .from('accounts')
            .update({ balance: Number(acc.balance) + delta })
            .eq('id', default_account_id)
        }
      }

      const emoji = parsed.type === 'income' ? '✅' : '❌'
      const typeLabel = parsed.type === 'income' ? 'Receita' : 'Despesa'

      return NextResponse.json({
        reply: `${emoji} *${typeLabel} registrada!*\n\n` +
          `💵 Valor: ${formatCurrency(parsed.amount)}\n` +
          `📝 Descrição: ${parsed.description}\n` +
          `🏷️ Categoria: ${category?.name ?? guessed}\n` +
          `📅 Data: ${new Date().toLocaleDateString('pt-BR')}`
      })
    }

    return NextResponse.json({
      reply: '🤔 Não entendi. Digite *ajuda* para ver os comandos disponíveis.'
    })

  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
