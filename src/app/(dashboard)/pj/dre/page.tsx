'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const MONTHS_BACK = 12

export default function DREPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [dre, setDre] = useState<any>(null)
  const [proLabore, setProLabore] = useState(0)
  const [taxes, setTaxes] = useState(0)

  const months = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = subMonths(new Date(), i)
    return {
      label: format(d, "MMM/yyyy", { locale: ptBR }),
      full: format(d, "MMMM 'de' yyyy", { locale: ptBR }),
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end: format(endOfMonth(d), 'yyyy-MM-dd'),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    }
  })

  useEffect(() => { load() }, [selectedMonth])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end, month, year } = months[selectedMonth]

    const { data: pjAccounts } = await supabase.from('accounts').select('id').eq('user_id', user.id).eq('profile', 'pj')
    const pjIds = (pjAccounts ?? []).map(a => a.id)

    if (pjIds.length === 0) {
      setDre({ receita: 0, custos: 0, despesas: {}, totalDespesas: 0, lucro: 0 })
      setLoading(false)
      return
    }

    const { data: txs } = await supabase
      .from('transactions').select('type, amount, category:categories(name, type)')
      .eq('user_id', user.id).in('account_id', pjIds).gte('date', start).lte('date', end)

    const receita = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)

    // Agrupa despesas por categoria
    const despMap: Record<string, number> = {}
    ;(txs ?? []).filter(t => t.type === 'expense').forEach((t: any) => {
      const cat = t.category?.name ?? 'Outros'
      despMap[cat] = (despMap[cat] ?? 0) + Number(t.amount)
    })
    const totalDespesas = Object.values(despMap).reduce((s, v) => s + v, 0)

    // Pró-labore e impostos do mês
    const { data: pl } = await supabase.from('pro_labore').select('amount').eq('user_id', user.id).eq('month', month).eq('year', year).single()
    const { data: tax } = await supabase.from('tax_entries').select('amount').eq('user_id', user.id).eq('reference_month', month).eq('reference_year', year)

    const plAmount = pl?.amount ?? 0
    const taxAmount = (tax ?? []).reduce((s, t) => s + Number(t.amount), 0)

    setProLabore(plAmount)
    setTaxes(taxAmount)
    setDre({ receita, despesas: despMap, totalDespesas, lucro: receita - totalDespesas - plAmount - taxAmount })
    setLoading(false)
  }

  const Row = ({ label, value, indent = 0, bold = false, color = 'text-slate-300', sign = '' }: any) => (
    <div className={`flex justify-between py-2 ${indent > 0 ? `pl-${indent * 4}` : ''} ${bold ? 'border-t border-slate-700 mt-1 pt-3' : 'border-b border-slate-800/50'}`}>
      <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{sign}{formatCurrency(value)}</span>
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {/* Seletor de mês */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {months.map((m, i) => (
          <button key={i} onClick={() => setSelectedMonth(i)}
            className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${selectedMonth === i ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : !dre ? null : (
        <div className="card">
          <h2 className="text-lg font-bold text-white mb-1">DRE — {months[selectedMonth].full}</h2>
          <p className="text-xs text-slate-500 mb-6">Demonstrativo de Resultado do Exercício (Conta PJ)</p>

          {/* Receita */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Receita</p>
            <Row label="(+) Receita Bruta de Serviços" value={dre.receita} color="text-primary-400" sign="+" />
            <Row label="= Receita Líquida" value={dre.receita} bold color="text-primary-400" />
          </div>

          {/* Despesas operacionais */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Despesas Operacionais</p>
            {Object.entries(dre.despesas).map(([cat, val]: any) => (
              <Row key={cat} label={`(-) ${cat}`} value={val} color="text-red-400" sign="-" />
            ))}
            {dre.totalDespesas === 0 && <p className="text-slate-600 text-sm py-2">Nenhuma despesa registrada</p>}
          </div>

          {/* Pró-labore e impostos */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Remuneração e Tributos</p>
            <Row label="(-) Pró-labore" value={proLabore} color="text-purple-400" sign="-" />
            <Row label="(-) DAS / Impostos" value={taxes} color="text-yellow-400" sign="-" />
          </div>

          {/* Resultado */}
          <div className="mt-2">
            <Row
              label="= RESULTADO LÍQUIDO"
              value={Math.abs(dre.lucro)}
              bold
              color={dre.lucro >= 0 ? 'text-primary-400' : 'text-red-400'}
              sign={dre.lucro >= 0 ? '+' : '-'}
            />
          </div>

          {/* Margem */}
          {dre.receita > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Margem Bruta', value: ((dre.receita - dre.totalDespesas) / dre.receita * 100).toFixed(1) + '%' },
                { label: 'Margem Líquida', value: (dre.lucro / dre.receita * 100).toFixed(1) + '%' },
                { label: 'Carga Tributária', value: (taxes / dre.receita * 100).toFixed(1) + '%' },
              ].map(item => (
                <div key={item.label} className="bg-slate-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="text-base font-bold text-white mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
