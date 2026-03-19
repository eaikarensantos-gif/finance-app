'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, getLast6Months, getMonthRange } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Zap, Target, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface Insight {
  type: 'good' | 'warning' | 'info'
  title: string
  description: string
  value?: string
}

export default function InsightsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<Insight[]>([])
  const [stats, setStats] = useState<any>({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end } = getMonthRange()
    const prevMonth = subMonths(new Date(), 1)
    const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd')
    const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd')

    // Dados do mês atual e anterior
    const [currRes, prevRes, allRes, accRes] = await Promise.all([
      supabase.from('transactions').select('type, amount, category:categories(name), date').eq('user_id', user.id).gte('date', start).lte('date', end),
      supabase.from('transactions').select('type, amount, category:categories(name)').eq('user_id', user.id).gte('date', prevStart).lte('date', prevEnd),
      supabase.from('transactions').select('type, amount, date, category:categories(name)').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('accounts').select('balance, profile').eq('user_id', user.id),
    ])

    const curr = currRes.data ?? []
    const prev = prevRes.data ?? []
    const all = allRes.data ?? []
    const accs = accRes.data ?? []

    const currIncome = curr.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const currExpense = curr.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const prevIncome = prev.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const prevExpense = prev.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const totalBalance = accs.reduce((s, a) => s + Number(a.balance), 0)
    const savingsRate = currIncome > 0 ? ((currIncome - currExpense) / currIncome) * 100 : 0

    // Categoria com mais gastos este mês
    const catMap: Record<string, number> = {}
    curr.filter(t => t.type === 'expense').forEach((t: any) => {
      const cat = t.category?.name ?? 'Outros'
      catMap[cat] = (catMap[cat] ?? 0) + Number(t.amount)
    })
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]

    // Maior gasto individual
    const topTx = curr.filter(t => t.type === 'expense').sort((a, b) => Number(b.amount) - Number(a.amount))[0]

    // Dia da semana com mais gastos (últimos 30 dias)
    const weekdayMap: Record<number, number> = {}
    all.slice(0, 60).filter(t => t.type === 'expense').forEach((t: any) => {
      const day = new Date(t.date).getDay()
      weekdayMap[day] = (weekdayMap[day] ?? 0) + Number(t.amount)
    })
    const topWeekday = Object.entries(weekdayMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
    const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

    // Previsão do mês (extrapolação linear)
    const today = new Date()
    const dayOfMonth = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const projectedExpense = dayOfMonth > 0 ? (currExpense / dayOfMonth) * daysInMonth : 0
    const projectedIncome = dayOfMonth > 0 ? (currIncome / dayOfMonth) * daysInMonth : 0

    // Meses de reserva de emergência (regra: 6 meses de despesas médias)
    const months6 = getLast6Months()
    const avg6Expense = await (async () => {
      const results = await Promise.all(months6.map(async ({ start: s, end: e }) => {
        const { data } = await supabase.from('transactions').select('amount').eq('user_id', user.id).eq('type', 'expense').gte('date', s).lte('date', e)
        return (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0)
      }))
      return results.reduce((s, v) => s + v, 0) / 6
    })()
    const reserveMonths = avg6Expense > 0 ? totalBalance / avg6Expense : 0

    setStats({
      currIncome, currExpense, prevIncome, prevExpense, savingsRate,
      topCat, topTx, topWeekday, projectedExpense, projectedIncome,
      totalBalance, avg6Expense, reserveMonths
    })

    // Gera insights
    const generated: Insight[] = []

    // Taxa de poupança
    if (savingsRate >= 20) {
      generated.push({ type: 'good', title: 'Ótima taxa de poupança!', description: `Você está poupando ${savingsRate.toFixed(1)}% da sua renda este mês.`, value: `${savingsRate.toFixed(1)}%` })
    } else if (savingsRate > 0) {
      generated.push({ type: 'warning', title: 'Taxa de poupança baixa', description: `Você está poupando apenas ${savingsRate.toFixed(1)}% da renda. O ideal é 20% ou mais.`, value: `${savingsRate.toFixed(1)}%` })
    } else if (currIncome > 0) {
      generated.push({ type: 'warning', title: 'Gastos acima da renda!', description: `Suas despesas (${formatCurrency(currExpense)}) superam as receitas (${formatCurrency(currIncome)}) este mês.` })
    }

    // Variação em relação ao mês anterior
    if (prevExpense > 0) {
      const diff = ((currExpense - prevExpense) / prevExpense) * 100
      if (diff > 20) {
        generated.push({ type: 'warning', title: 'Gastos aumentaram', description: `Suas despesas subiram ${diff.toFixed(0)}% comparado ao mês passado.`, value: `+${diff.toFixed(0)}%` })
      } else if (diff < -10) {
        generated.push({ type: 'good', title: 'Você reduziu os gastos', description: `Suas despesas caíram ${Math.abs(diff).toFixed(0)}% comparado ao mês passado.`, value: `${diff.toFixed(0)}%` })
      }
    }

    // Top categoria
    if (topCat) {
      generated.push({ type: 'info', title: `Maior gasto: ${topCat[0]}`, description: `${formatCurrency(topCat[1])} gastos em ${topCat[0]} este mês (${currExpense > 0 ? ((topCat[1] / currExpense) * 100).toFixed(0) : 0}% das despesas).`, value: formatCurrency(topCat[1]) })
    }

    // Reserva de emergência
    if (reserveMonths < 3) {
      generated.push({ type: 'warning', title: 'Reserva de emergência insuficiente', description: `Seu saldo cobre apenas ${reserveMonths.toFixed(1)} meses de gastos. O recomendado é 6 meses.`, value: `${reserveMonths.toFixed(1)} meses` })
    } else if (reserveMonths >= 6) {
      generated.push({ type: 'good', title: 'Reserva de emergência sólida', description: `Seu saldo cobre ${reserveMonths.toFixed(1)} meses de gastos. Excelente!`, value: `${reserveMonths.toFixed(1)} meses` })
    }

    // Previsão do mês
    if (projectedExpense > 0 && currIncome > 0) {
      if (projectedExpense > projectedIncome) {
        generated.push({ type: 'warning', title: 'Previsão negativa para o mês', description: `Com base no ritmo atual, você deve gastar ${formatCurrency(projectedExpense)} e receber ${formatCurrency(projectedIncome)}.`, value: formatCurrency(projectedIncome - projectedExpense) })
      } else {
        generated.push({ type: 'info', title: 'Previsão do mês', description: `Com base no ritmo atual: receita prevista ${formatCurrency(projectedIncome)}, despesa prevista ${formatCurrency(projectedExpense)}.`, value: formatCurrency(projectedIncome - projectedExpense) })
      }
    }

    // Dia de maior gasto
    if (topWeekday) {
      generated.push({ type: 'info', title: `${weekdays[parseInt(topWeekday[0])]} é seu dia de maior gasto`, description: `Você tende a gastar mais nas ${weekdays[parseInt(topWeekday[0])]?.toLowerCase()}s. Fique atento nesse dia!` })
    }

    setInsights(generated)
    setLoading(false)
  }

  const iconMap = { good: CheckCircle2, warning: AlertCircle, info: Zap }
  const colorMap = {
    good: 'border-primary-500/30 bg-primary-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  }
  const iconColorMap = { good: 'text-primary-400', warning: 'text-yellow-400', info: 'text-blue-400' }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : (
        <>
          {/* Resumo rápido */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Taxa de poupança', value: `${stats.savingsRate?.toFixed(1)}%`, color: stats.savingsRate >= 20 ? 'text-primary-400' : stats.savingsRate > 0 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'Reserva (meses)', value: `${stats.reserveMonths?.toFixed(1)}x`, color: stats.reserveMonths >= 6 ? 'text-primary-400' : stats.reserveMonths >= 3 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'Previsão de receita', value: formatCurrency(stats.projectedIncome ?? 0), color: 'text-primary-400' },
              { label: 'Previsão de gasto', value: formatCurrency(stats.projectedExpense ?? 0), color: 'text-red-400' },
            ].map(item => (
              <div key={item.label} className="card">
                <p className="text-slate-400 text-sm mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white">Análise Inteligente</h2>
            {insights.length === 0 ? (
              <p className="text-slate-500 text-sm">Adicione mais transações para gerar insights.</p>
            ) : (
              insights.map((insight, i) => {
                const Icon = iconMap[insight.type]
                return (
                  <div key={i} className={`border rounded-2xl p-5 flex gap-4 ${colorMap[insight.type]}`}>
                    <Icon size={22} className={`shrink-0 mt-0.5 ${iconColorMap[insight.type]}`} />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-white text-sm">{insight.title}</p>
                        {insight.value && <span className={`text-sm font-bold shrink-0 ${iconColorMap[insight.type]}`}>{insight.value}</span>}
                      </div>
                      <p className="text-slate-400 text-sm mt-0.5">{insight.description}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
