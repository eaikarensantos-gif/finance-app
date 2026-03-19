'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, getMonthRange } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, FileText, Users, Landmark, User, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function PJDashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [pendingInvoices, setPendingInvoices] = useState(0)
  const [pendingTax, setPendingTax] = useState(0)
  const [proLabore, setProLabore] = useState(0)
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end } = getMonthRange()

    // Busca contas PJ
    const { data: pjAccounts } = await supabase
      .from('accounts').select('id').eq('user_id', user.id).eq('profile', 'pj')
    const pjIds = (pjAccounts ?? []).map(a => a.id)

    if (pjIds.length > 0) {
      const { data: txs } = await supabase
        .from('transactions').select('type, amount')
        .eq('user_id', user.id)
        .in('account_id', pjIds)
        .gte('date', start).lte('date', end)

      const inc = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const exp = (txs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      setRevenue(inc)
      setExpenses(exp)
    }

    // NFs pendentes
    const { data: invs } = await supabase
      .from('invoices').select('*').eq('user_id', user.id)
      .eq('status', 'pending').order('issue_date', { ascending: false })
    const totalPending = (invs ?? []).reduce((s, i) => s + Number(i.amount), 0)
    setPendingInvoices(totalPending)
    setRecentInvoices((invs ?? []).slice(0, 5))

    // Imposto pendente
    const thisMonth = new Date().getMonth() + 1
    const thisYear = new Date().getFullYear()
    const { data: tax } = await supabase
      .from('tax_entries').select('amount')
      .eq('user_id', user.id).eq('status', 'pending')
      .eq('reference_year', thisYear)
    const totalTax = (tax ?? []).reduce((s, t) => s + Number(t.amount), 0)
    setPendingTax(totalTax)

    // Pró-labore do mês
    const { data: pl } = await supabase
      .from('pro_labore').select('amount')
      .eq('user_id', user.id).eq('month', thisMonth).eq('year', thisYear).single()
    setProLabore(pl?.amount ?? 0)

    // Trend 6 meses PJ
    if (pjIds.length > 0) {
      const trend = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = subMonths(new Date(), 5 - i)
          return { label: format(d, 'MMM', { locale: ptBR }), start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') }
        }).map(async ({ label, start: s, end: e }) => {
          const { data } = await supabase.from('transactions').select('type, amount')
            .eq('user_id', user.id).in('account_id', pjIds).gte('date', s).lte('date', e)
          const rec = (data ?? []).filter(t => t.type === 'income').reduce((x, t) => x + Number(t.amount), 0)
          const des = (data ?? []).filter(t => t.type === 'expense').reduce((x, t) => x + Number(t.amount), 0)
          return { month: label, Receita: rec, Despesa: des, Lucro: rec - des }
        })
      )
      setTrendData(trend)
    }

    setLoading(false)
  }

  const profit = revenue - expenses
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard PJ</h2>
          <p className="text-slate-400 text-sm">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Link href="/import" className="btn-primary text-sm">+ Importar extrato</Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Receita Bruta', value: revenue, color: 'text-primary-400', icon: TrendingUp, iconColor: 'text-primary-400' },
          { label: 'Despesas', value: expenses, color: 'text-red-400', icon: TrendingDown, iconColor: 'text-red-400' },
          { label: 'Lucro Líquido', value: profit, color: profit >= 0 ? 'text-primary-400' : 'text-red-400', icon: TrendingUp, iconColor: profit >= 0 ? 'text-primary-400' : 'text-red-400' },
          { label: 'Margem', value: margin, color: margin >= 20 ? 'text-primary-400' : 'text-yellow-400', isPercent: true, icon: TrendingUp, iconColor: 'text-slate-400' },
        ].map(item => (
          <div key={item.label} className="card">
            <div className="flex items-start justify-between mb-2">
              <p className="text-slate-400 text-sm">{item.label}</p>
              <item.icon size={18} className={item.iconColor} />
            </div>
            <p className={`text-xl font-bold ${item.color}`}>
              {item.isPercent ? `${margin.toFixed(1)}%` : formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-slate-400 text-sm mb-1">NFs a receber</p>
          <p className="text-xl font-bold text-yellow-400">{formatCurrency(pendingInvoices)}</p>
          <Link href="/pj/invoices" className="text-xs text-primary-400 hover:text-primary-300 mt-1 inline-block">Ver notas →</Link>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm mb-1">Impostos pendentes</p>
          <p className={`text-xl font-bold ${pendingTax > 0 ? 'text-red-400' : 'text-primary-400'}`}>{formatCurrency(pendingTax)}</p>
          <Link href="/pj/taxes" className="text-xs text-primary-400 hover:text-primary-300 mt-1 inline-block">Ver impostos →</Link>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm mb-1">Pró-labore (mês)</p>
          <p className="text-xl font-bold text-purple-400">{formatCurrency(proLabore)}</p>
          <Link href="/pj/taxes" className="text-xs text-primary-400 hover:text-primary-300 mt-1 inline-block">Gerenciar →</Link>
        </div>
      </div>

      {/* Gráfico */}
      {trendData.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold text-white mb-4">Resultado PJ — 6 meses</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 12 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lucro" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* NFs recentes */}
      {recentInvoices.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Notas Fiscais Pendentes</h3>
            <Link href="/pj/invoices" className="text-primary-400 text-sm hover:text-primary-300">Ver todas</Link>
          </div>
          <div className="divide-y divide-slate-800">
            {recentInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">{inv.description}</p>
                  <p className="text-xs text-slate-500">{inv.issue_date} {inv.number && `· NF #${inv.number}`}</p>
                </div>
                <span className="text-primary-400 font-semibold text-sm">{formatCurrency(inv.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
