'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '@/lib/utils'
import type { Account } from '@/types'
import { Plus, Trash2, Edit2, X, Loader2, Wallet, CreditCard, PiggyBank, Banknote, TrendingUp } from 'lucide-react'

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  checking: <Banknote size={20} />,
  savings: <PiggyBank size={20} />,
  credit: <CreditCard size={20} />,
  cash: <Wallet size={20} />,
  investment: <TrendingUp size={20} />,
}

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#f59e0b', '#ef4444']

const EMPTY_FORM = { name: '', type: 'checking', balance: '0', color: '#22c55e' }

export default function AccountsPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at')
    setAccounts(data ?? [])
    setLoading(false)
  }

  async function save() {
    if (!form.name) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: form.name,
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      color: form.color,
    }

    if (editingId) {
      await supabase.from('accounts').update(payload).eq('id', editingId)
    } else {
      await supabase.from('accounts').insert(payload)
    }

    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remover esta conta? As transações vinculadas serão mantidas.')) return
    await supabase.from('accounts').delete().eq('id', id)
    load()
  }

  function openEdit(acc: Account) {
    setForm({ name: acc.name, type: acc.type, balance: String(acc.balance), color: acc.color })
    setEditingId(acc.id)
    setShowModal(true)
  }

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="card inline-flex flex-col">
          <p className="text-slate-400 text-sm">Patrimônio Total</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalBalance)}</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nova Conta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="card relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: acc.color }} />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${acc.color}20`, color: acc.color }}>
                    {ACCOUNT_ICONS[acc.type] ?? <Wallet size={20} />}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{acc.name}</p>
                    <p className="text-xs text-slate-500">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(acc)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => remove(acc.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className={`text-2xl font-bold ${Number(acc.balance) >= 0 ? 'text-white' : 'text-red-400'}`}>
                {formatCurrency(acc.balance)}
              </p>
            </div>
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <Wallet size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma conta ainda.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">{editingId ? 'Editar' : 'Nova'} Conta</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome</label>
                <input type="text" className="input" placeholder="Ex: Nubank, Carteira..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Saldo Inicial (R$)</label>
                <input type="number" step="0.01" className="input" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={18} className="animate-spin" />}
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
