'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction, Account, Category } from '@/types'
import { Plus, Search, Trash2, Edit2, X, Loader2, AlertTriangle } from 'lucide-react'

const EMPTY_FORM = {
  type: 'expense' as 'income' | 'expense',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  category_id: '',
  account_id: '',
  notes: '',
}

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [txRes, accRes, catRes] = await Promise.all([
      supabase.from('transactions').select('*, account:accounts(name), category:categories(name, color, icon)').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('categories').select('*').or(`user_id.eq.${user.id},is_default.eq.true`).order('name'),
    ])
    setTransactions((txRes.data ?? []) as Transaction[])
    setAccounts(accRes.data ?? [])
    setCategories(catRes.data ?? [])
    setLoading(false)
  }

  async function save() {
    if (!form.amount || !form.description) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
      date: form.date,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      notes: form.notes || null,
    }

    if (editingId) {
      await supabase.from('transactions').update(payload).eq('id', editingId)
      // Atualiza saldo da conta
    } else {
      await supabase.from('transactions').insert(payload)
      // Atualiza saldo da conta
      if (form.account_id) {
        const acc = accounts.find(a => a.id === form.account_id)
        if (acc) {
          const delta = form.type === 'income' ? parseFloat(form.amount) : -parseFloat(form.amount)
          await supabase.from('accounts').update({ balance: acc.balance + delta }).eq('id', acc.id)
        }
      }
    }

    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remover esta transação?')) return
    await supabase.from('transactions').delete().eq('id', id)
    load()
  }

  async function removeAll() {
    if (!confirm('⚠️ Apagar TODAS as transações? Esta ação não pode ser desfeita!')) return
    if (!confirm('Tem certeza? Todos os registros serão deletados permanentemente.')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').delete().eq('user_id', user.id)
    load()
  }

  function openEdit(tx: Transaction) {
    setForm({
      type: tx.type as 'income' | 'expense',
      amount: String(tx.amount),
      description: tx.description,
      date: tx.date,
      category_id: tx.category_id ?? '',
      account_id: tx.account_id ?? '',
      notes: tx.notes ?? '',
    })
    setEditingId(tx.id)
    setShowModal(true)
  }

  const filtered = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Buscar transações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                filterType === t ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'income' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
        {transactions.length > 0 && (
          <button onClick={removeAll} className="btn-danger flex items-center gap-2">
            <AlertTriangle size={16} />
            Apagar tudo
          </button>
        )}
        <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nova
        </button>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>Nenhuma transação encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: `${(tx.category as any)?.color ?? '#6b7280'}20` }}
                  >
                    {tx.type === 'income' ? '↑' : '↓'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{tx.description}</p>
                    <p className="text-xs text-slate-500">
                      {(tx.category as any)?.name ?? 'Sem categoria'}
                      {tx.account && ` · ${(tx.account as any).name}`}
                      {' · '}{formatDate(tx.date)}
                      {tx.source === 'whatsapp' && <span className="ml-1 text-primary-400">📱 WhatsApp</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-primary-400' : 'text-red-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(tx)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => remove(tx.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">{editingId ? 'Editar' : 'Nova'} Transação</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2">
                {(['expense', 'income'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      form.type === t
                        ? t === 'income' ? 'bg-primary-500 text-white' : 'bg-red-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t === 'income' ? '↑ Receita' : '↓ Despesa'}
                  </button>
                ))}
              </div>

              <div>
                <label className="label">Valor (R$)</label>
                <input type="number" step="0.01" min="0" className="input" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              <div>
                <label className="label">Descrição</label>
                <input type="text" className="input" placeholder="Ex: Mercado, Salário..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <label className="label">Data</label>
                <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>

              <div>
                <label className="label">Categoria</label>
                <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categories.filter(c => c.type === form.type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Conta</label>
                <select className="input" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                  <option value="">Sem conta</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Observações</label>
                <textarea className="input resize-none" rows={2} placeholder="Opcional..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={18} className="animate-spin" />}
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar transação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
