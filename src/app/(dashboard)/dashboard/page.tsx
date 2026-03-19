'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, getMonthRange, getLast6Months } from '@/lib/utils'
import type { Account, Transaction, Goal, Category } from '@/types'
import {
  TrendingUp, TrendingDown, Wallet, Target,
  ArrowUpRight, ArrowDownRight, Plus
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [totalBalance, setTotalBalance] = useState(0)
  const [monthIncome, setMonthIncome] = useState(0)
  const [monthExpense, setMonthExpense] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [pieData, setPieData] = useState<{ name: string; value: number; color: string }[]>([])
  const [trendData, setTrendData] = useState<{ month: string; receitas: number; despesas: number }[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end } = getMonthRange()
    const months = getLast6Months()

    const [accountsRes, transactionsRes, goalsRes, categoriesRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user.id).order('date', { ascending: false }).limit(8),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('completed', false).limit(4),
      supabase.from('categories').select('*').or(`user_id.eq.${user.id},is_default.eq.true`),
    ])

    const accs = accountsRes.data ?? []
    setAccounts(accs)
    setTotalBalance(accs.reduce((s, a) => s + Number(a.balance), 0))

    const txs = transactionsRes.data ?? []
    setRecentTransactions(txs as Transaction[])

    // Receita/despesa do mês
    const { data: monthTxs } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)

    const income = (monthTxs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = (monthTxs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    setMonthIncome(income)
    setMonthExpense(expense)

    setGoals(goalsRes.data ?? [])

    // Pie: despesas por categoria no mês
    const { data: catTxs } = await supabase
      .from('transactions')
      .select('amount, category_id, category:categories(name, color)')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', start)
      .lte('date', end)

    const catMap: Record<string, { name: string; value: number; color: string }> = {}
    ;(catTxs ?? []).forEach((t: any) => {
      const key = t.category_id ?? 'outros'
      const name = t.category?.name ?? 'Outros'
      const color = t.category?.color ?? '#6b7280'
      if (!catMap[key]) catMap[key] = { name, value: 0, color }
      catMap[key].value += Number(t.amount)
    })
    setPieData(Object.values(catMap).sort((a, b) => b.value - a.value).slice(0, 6))

    // Trend: últimos 6 meses
    const trend = await Promise.all(
      months.map(async ({ label, start: s, end: e }) => {
        const { data } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', user.id)
          .gte('date', s)
          .lte('date', e)
        const rec = (data ?? []).filter(t => t.type === 'income').reduce((x, t) => x + Number(t.amount), 0)
        const des = (data ?? []).filter(t => t.type === 'expense').reduce((x, t) => x + Number(t.amount), 0)
        return { month: label, receitas: rec, despesas: des }
      })
    )
    setTrendData(trend)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-slate-400 text-sm">Saldo Total</p>
            <Wallet size={20} className="text-primary-400" />
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalBalance)}</p>
          <p className="text-slate-500 text-xs mt-1">{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-slate-400 text-sm">Receitas (mês)</p>
            <TrendingUp size={20} className="text-primary-400" />
          </div>
          <p className="text-2xl font-bold text-primary-400">{formatCurrency(monthIncome)}</p>
          <p className="text-slate-500 text-xs mt-1">Este mês</p>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-slate-400 text-sm">Despesas (mês)</p>
            <TrendingDown size={20} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(monthExpense)}</p>
          <p className="text-slate-500 text-xs mt-1">Este mês</p>
        </div>

        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <p className="text-slate-400 text-sm">Saldo do Mês</p>
            {monthIncome - monthExpense >= 0
              ? <ArrowUpRight size={20} className="text-primary-400" />
              : <ArrowDownRight size={20} className="text-red-400" />
            }
          </div>
          <p className={`text-2xl font-bold ${monthIncome - monthExpense >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
            {formatCurrency(monthIncome - monthExpense)}
          </p>
          <p className="text-slate-500 text-xs mt-1">Receitas - Despesas</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trend */}
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-white mb-4">Receitas vs Despesas (6 meses)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 12 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Area type="monotone" dataKey="receitas" stroke="#22c55e" fill="url(#colorRec)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesas" stroke="#ef4444" fill="url(#colorDes)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">Despesas por Categoria</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
              Nenhuma despesa este mês
            </div>
          )}
        </div>
      </div>

      {/* Transações recentes + Metas */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Transações recentes */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Transações Recentes</h2>
            <Link href="/transactions" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
              Ver todas
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p>Nenhuma transação ainda.</p>
              <Link href="/transactions" className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block">
                + Adicionar primeira transação
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                      style={{ backgroundColor: `${(tx.category as any)?.color ?? '#6b7280'}20` }}
                    >
                      {tx.type === 'income' ? '↑' : '↓'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-100">{tx.description}</p>
                      <p className="text-xs text-slate-500">{(tx.category as any)?.name ?? 'Sem categoria'} · {tx.date}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-primary-400' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Metas</h2>
            <Link href="/goals" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
              Ver todas
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Target size={32} className="mx-auto mb-2 opacity-50" />
              <p>Nenhuma meta criada.</p>
              <Link href="/goals" className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block">
                + Criar meta
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map(goal => {
                const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                return (
                  <div key={goal.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-100 font-medium">{goal.name}</span>
                      <span className="text-slate-400">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{formatCurrency(goal.current_amount)}</span>
                      <span>{formatCurrency(goal.target_amount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
