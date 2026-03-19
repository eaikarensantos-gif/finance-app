'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, X, Loader2, CheckCircle2, AlertCircle, Clock, Landmark, User } from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const SIMPLES_ANEXO_III = [
  { min: 0, max: 180000, rate: 0.06, deduction: 0 },
  { min: 180000, max: 360000, rate: 0.112, deduction: 9360 },
  { min: 360000, max: 720000, rate: 0.135, deduction: 17640 },
  { min: 720000, max: 1800000, rate: 0.16, deduction: 35640 },
  { min: 1800000, max: 3600000, rate: 0.21, deduction: 125640 },
  { min: 3600000, max: 4800000, rate: 0.33, deduction: 648000 },
]

function calcSimplesRate(rbt12: number): { nominalRate: number; effectiveRate: number; deduction: number } {
  const faixa = SIMPLES_ANEXO_III.find(f => rbt12 > f.min && rbt12 <= f.max) ?? SIMPLES_ANEXO_III[0]
  const effectiveRate = rbt12 > 0 ? (rbt12 * faixa.rate - faixa.deduction) / rbt12 : faixa.rate
  return { nominalRate: faixa.rate, effectiveRate: Math.max(effectiveRate, 0), deduction: faixa.deduction }
}

export default function TaxesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [taxes, setTaxes] = useState<any[]>([])
  const [proLabores, setProLabores] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [showTaxModal, setShowTaxModal] = useState(false)
  const [showPLModal, setShowPLModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rbt12, setRbt12] = useState(0)
  const [taxForm, setTaxForm] = useState({
    type: 'das_simples', regime: 'simples', reference_month: new Date().getMonth() + 1,
    reference_year: new Date().getFullYear(), gross_revenue: '', rbt12: '', amount: '',
    due_date: '', status: 'pending', das_number: '', notes: '',
  })
  const [plForm, setPlForm] = useState({
    amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    paid_date: '', inss_rate: '11', notes: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [taxRes, plRes, settRes] = await Promise.all([
      supabase.from('tax_entries').select('*').eq('user_id', user.id).order('reference_year', { ascending: false }).order('reference_month', { ascending: false }),
      supabase.from('pro_labore').select('*').eq('user_id', user.id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('company_settings').select('*').eq('user_id', user.id).single(),
    ])

    setTaxes(taxRes.data ?? [])
    setProLabores(plRes.data ?? [])
    setSettings(settRes.data)

    // Calcula RBT12 automático
    const start12 = format(subMonths(new Date(), 12), 'yyyy-MM-dd')
    const { data: pjAccounts } = await supabase.from('accounts').select('id').eq('user_id', user.id).eq('profile', 'pj')
    const pjIds = (pjAccounts ?? []).map(a => a.id)
    if (pjIds.length > 0) {
      const { data: rev } = await supabase.from('transactions').select('amount').eq('user_id', user.id).in('account_id', pjIds).eq('type', 'income').gte('date', start12)
      const total = (rev ?? []).reduce((s, t) => s + Number(t.amount), 0)
      setRbt12(total)
    }

    setLoading(false)
  }

  async function saveTax() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('tax_entries').upsert({
      user_id: user.id,
      type: taxForm.type,
      regime: taxForm.regime,
      reference_month: taxForm.reference_month,
      reference_year: taxForm.reference_year,
      gross_revenue: parseFloat(taxForm.gross_revenue) || null,
      rbt12: parseFloat(taxForm.rbt12) || rbt12 || null,
      amount: parseFloat(taxForm.amount),
      due_date: taxForm.due_date || null,
      status: taxForm.status,
      das_number: taxForm.das_number || null,
      notes: taxForm.notes || null,
    }, { onConflict: 'user_id,type,reference_month,reference_year' })

    setShowTaxModal(false)
    setSaving(false)
    load()
  }

  async function saveProLabore() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('pro_labore').upsert({
      user_id: user.id,
      amount: parseFloat(plForm.amount),
      month: plForm.month,
      year: plForm.year,
      paid_date: plForm.paid_date || null,
      inss_rate: parseFloat(plForm.inss_rate) / 100,
      notes: plForm.notes || null,
    }, { onConflict: 'user_id,month,year' })

    setShowPLModal(false)
    setSaving(false)
    load()
  }

  async function markTaxPaid(id: string) {
    await supabase.from('tax_entries').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    load()
  }

  const simplesCalc = calcSimplesRate(rbt12)
  const pendingTaxes = taxes.filter(t => t.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Calculadora Simples */}
      <div className="card bg-gradient-to-br from-slate-900 to-slate-800 border-primary-500/30">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Landmark size={18} className="text-primary-400" /> Simples Nacional — Calculadora
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400">RBT12 (últimos 12 meses)</p>
            <p className="text-xl font-bold text-white mt-1">{formatCurrency(rbt12)}</p>
            <p className="text-xs text-slate-500 mt-0.5">calculado automaticamente</p>
          </div>
          <div>
            <p className="text-slate-400">Alíquota efetiva (Anexo III)</p>
            <p className="text-xl font-bold text-primary-400 mt-1">{(simplesCalc.effectiveRate * 100).toFixed(2)}%</p>
            <p className="text-xs text-slate-500">nominal: {(simplesCalc.nominalRate * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-slate-400">DAS estimado (se receita = RBT12/12)</p>
            <p className="text-xl font-bold text-yellow-400 mt-1">{formatCurrency((rbt12 / 12) * simplesCalc.effectiveRate)}</p>
            <p className="text-xs text-slate-500">por mês</p>
          </div>
        </div>
      </div>

      {/* Alertas pendentes */}
      {pendingTaxes.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 font-medium text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {pendingTaxes.length} DAS pendente{pendingTaxes.length !== 1 ? 's' : ''} — Total: {formatCurrency(pendingTaxes.reduce((s, t) => s + Number(t.amount), 0))}
          </p>
        </div>
      )}

      {/* DAS */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white">Histórico de DAS</h3>
        <button onClick={() => setShowTaxModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Registrar DAS
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {taxes.length === 0 ? (
          <p className="text-center py-8 text-slate-500 text-sm">Nenhum DAS registrado.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {taxes.map(tax => (
              <div key={tax.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    DAS {tax.regime === 'mei' ? 'MEI' : 'Simples'} — {MONTHS[tax.reference_month - 1]} {tax.reference_year}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tax.gross_revenue && `Receita: ${formatCurrency(tax.gross_revenue)}`}
                    {tax.rbt12 && ` · RBT12: ${formatCurrency(tax.rbt12)}`}
                    {tax.effective_rate && ` · Alíquota: ${(tax.effective_rate * 100).toFixed(2)}%`}
                    {tax.due_date && ` · Venc: ${formatDate(tax.due_date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    tax.status === 'paid' ? 'bg-primary-500/20 text-primary-400' :
                    tax.status === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {tax.status === 'paid' ? 'Pago' : tax.status === 'overdue' ? 'Vencido' : 'Pendente'}
                  </span>
                  <span className="text-sm font-bold text-white">{formatCurrency(tax.amount)}</span>
                  {tax.status !== 'paid' && (
                    <button onClick={() => markTaxPaid(tax.id)} className="p-1.5 text-slate-500 hover:text-primary-400 rounded-lg hover:bg-primary-500/10">
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pró-labore */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2"><User size={18} className="text-purple-400" /> Pró-labore</h3>
        <button onClick={() => setShowPLModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Registrar
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {proLabores.length === 0 ? (
          <p className="text-center py-8 text-slate-500 text-sm">Nenhum pró-labore registrado.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {proLabores.map(pl => {
              const inss = Number(pl.amount) * Number(pl.inss_rate)
              return (
                <div key={pl.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{MONTHS[pl.month - 1]} {pl.year}</p>
                    <p className="text-xs text-slate-500">
                      INSS: {formatCurrency(inss)} ({(Number(pl.inss_rate) * 100).toFixed(0)}%)
                      · Líquido: {formatCurrency(Number(pl.amount) - inss)}
                      {pl.paid_date && ` · Pago em ${formatDate(pl.paid_date)}`}
                    </p>
                  </div>
                  <span className="text-purple-400 font-bold text-sm">{formatCurrency(pl.amount)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal DAS */}
      {showTaxModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="font-bold text-white">Registrar DAS</h3>
              <button onClick={() => setShowTaxModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Regime</label>
                  <select className="input" value={taxForm.regime} onChange={e => setTaxForm(f => ({ ...f, regime: e.target.value, type: e.target.value === 'mei' ? 'das_mei' : 'das_simples' }))}>
                    <option value="simples">Simples Nacional</option>
                    <option value="mei">MEI (retroativo)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={taxForm.status} onChange={e => setTaxForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mês de referência</label>
                  <select className="input" value={taxForm.reference_month} onChange={e => setTaxForm(f => ({ ...f, reference_month: parseInt(e.target.value) }))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ano</label>
                  <input type="number" className="input" value={taxForm.reference_year} onChange={e => setTaxForm(f => ({ ...f, reference_year: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Receita bruta do mês (R$)</label>
                  <input type="number" step="0.01" className="input" value={taxForm.gross_revenue} onChange={e => setTaxForm(f => ({ ...f, gross_revenue: e.target.value }))} />
                </div>
                <div>
                  <label className="label">RBT12 (R$)</label>
                  <input type="number" step="0.01" className="input" placeholder={String(Math.round(rbt12))} value={taxForm.rbt12} onChange={e => setTaxForm(f => ({ ...f, rbt12: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor do DAS (R$)</label>
                  <input type="number" step="0.01" className="input" value={taxForm.amount} onChange={e => setTaxForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Vencimento</label>
                  <input type="date" className="input" value={taxForm.due_date} onChange={e => setTaxForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Número do DAS</label>
                <input type="text" className="input" value={taxForm.das_number} onChange={e => setTaxForm(f => ({ ...f, das_number: e.target.value }))} />
              </div>
              <button onClick={saveTax} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pró-labore */}
      {showPLModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="font-bold text-white">Registrar Pró-labore</h3>
              <button onClick={() => setShowPLModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mês</label>
                  <select className="input" value={plForm.month} onChange={e => setPlForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ano</label>
                  <input type="number" className="input" value={plForm.year} onChange={e => setPlForm(f => ({ ...f, year: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Valor bruto (R$)</label>
                <input type="number" step="0.01" className="input" value={plForm.amount} onChange={e => setPlForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">INSS (%)</label>
                <input type="number" step="0.1" className="input" value={plForm.inss_rate} onChange={e => setPlForm(f => ({ ...f, inss_rate: e.target.value }))} />
              </div>
              {plForm.amount && (
                <div className="bg-slate-800 rounded-xl p-3 text-sm">
                  <p className="text-slate-400">INSS: <span className="text-red-400">- {formatCurrency(parseFloat(plForm.amount) * (parseFloat(plForm.inss_rate) / 100))}</span></p>
                  <p className="text-slate-300 font-semibold">Líquido: {formatCurrency(parseFloat(plForm.amount) * (1 - parseFloat(plForm.inss_rate) / 100))}</p>
                </div>
              )}
              <div>
                <label className="label">Data de pagamento</label>
                <input type="date" className="input" value={plForm.paid_date} onChange={e => setPlForm(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
              <button onClick={saveProLabore} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
