'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, getLast6Months, getMonthRange } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { detectPaymentMethod, paymentMethodLabel } from '@/lib/utils'

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = atual
  const [barData, setBarData] = useState<any[]>([])
  const [pieExpense, setPieExpense] = useState<any[]>([])
  const [pieIncome, setPieIncome] = useState<any[]>([])
  const [piePayment, setPiePayment] = useState<any[]>([])
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, txCount: 0 })

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return { label: format(d, "MMMM 'de' yyyy", { locale: ptBR }), value: i }
  })

  useEffect(() => { load() }, [selectedMonth])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const targetDate = subMonths(new Date(), selectedMonth)
    const start = format(startOfMonth(targetDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(targetDate), 'yyyy-MM-dd')

    // Transações do mês
    const { data: txs } = await supabase
      .from('transactions')
      .select('type, amount, category_id, payment_method, description, category:categories(name, color)')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)

    const income = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = (txs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    setSummary({ income, expense, balance: income - expense, txCount: (txs ?? []).length })

    // Pie despesas por categoria
    const expMap: Record<string, any> = {}
    ;(txs ?? []).filter(t => t.type === 'expense').forEach((t: any) => {
      const key = t.category_id ?? 'outros'
      const name = t.category?.name ?? 'Outros'
      const color = t.category?.color ?? '#6b7280'
      if (!expMap[key]) expMap[key] = { name, value: 0, color }
      expMap[key].value += Number(t.amount)
    })
    setPieExpense(Object.values(expMap).sort((a, b) => b.value - a.value))

    // Pie receitas por categoria
    const incMap: Record<string, any> = {}
    ;(txs ?? []).filter(t => t.type === 'income').forEach((t: any) => {
      const key = t.category_id ?? 'outros'
      const name = t.category?.name ?? 'Outros'
      const color = t.category?.color ?? '#22c55e'
      if (!incMap[key]) incMap[key] = { name, value: 0, color }
      incMap[key].value += Number(t.amount)
    })
    setPieIncome(Object.values(incMap).sort((a, b) => b.value - a.value))

    // Pie despesas por método de pagamento
    const PAYMENT_COLORS: Record<string, string> = {
      pix: '#22c55e', credit: '#6366f1', debit: '#f59e0b', cash: '#06b6d4', other: '#6b7280'
    }
    const payMap: Record<string, any> = {}
    ;(txs ?? []).filter(t => t.type === 'expense').forEach((t: any) => {
      const method = (t as any).payment_method || detectPaymentMethod(t.description ?? '')
      const label = paymentMethodLabel(method)
      if (!payMap[method]) payMap[method] = { name: label, value: 0, color: PAYMENT_COLORS[method] ?? '#6b7280' }
      payMap[method].value += Number(t.amount)
    })
    setPiePayment(Object.values(payMap).sort((a, b) => b.value - a.value))

    // Bar: últimos 6 meses
    const trend = await Promise.all(
      getLast6Months().map(async ({ label, start: s, end: e }) => {
        const { data } = await supabase.from('transactions').select('type, amount').eq('user_id', user.id).gte('date', s).lte('date', e)
        const rec = (data ?? []).filter(t => t.type === 'income').reduce((x, t) => x + Number(t.amount), 0)
        const des = (data ?? []).filter(t => t.type === 'expense').reduce((x, t) => x + Number(t.amount), 0)
        return { month: label, Receitas: rec, Despesas: des }
      })
    )
    setBarData(trend)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Seletor de mês */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {months.map(m => (
          <button
            key={m.value}
            onClick={() => setSelectedMonth(m.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              selectedMonth === m.value ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : (
        <>
          {/* Resumo do mês */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receitas', value: summary.income, color: 'text-primary-400' },
              { label: 'Despesas', value: summary.expense, color: 'text-red-400' },
              { label: 'Saldo', value: summary.balance, color: summary.balance >= 0 ? 'text-primary-400' : 'text-red-400' },
              { label: 'Transações', value: summary.txCount, color: 'text-blue-400', isMoney: false },
            ].map(item => (
              <div key={item.label} className="card">
                <p className="text-slate-400 text-sm mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.color}`}>
                  {item.isMoney === false ? item.value : formatCurrency(item.value)}
                </p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="card">
            <h2 className="text-base font-semibold text-white mb-4">Comparativo Mensal (6 meses)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 12 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="Receitas" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pies */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4">Despesas por Categoria</h2>
              {pieExpense.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieExpense} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieExpense.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-500 text-sm py-8 text-center">Nenhuma despesa neste período</p>}
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4">Receitas por Categoria</h2>
              {pieIncome.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieIncome} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieIncome.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-500 text-sm py-8 text-center">Nenhuma receita neste período</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
