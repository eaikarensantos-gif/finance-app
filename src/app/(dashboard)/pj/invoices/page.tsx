'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Trash2, Edit2, X, Loader2, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'text-yellow-400 bg-yellow-400/10', icon: Clock },
  paid: { label: 'Paga', color: 'text-primary-400 bg-primary-400/10', icon: CheckCircle2 },
  overdue: { label: 'Vencida', color: 'text-red-400 bg-red-400/10', icon: AlertCircle },
  cancelled: { label: 'Cancelada', color: 'text-slate-400 bg-slate-400/10', icon: X },
}

const EMPTY = {
  number: '', description: '', amount: '', issue_date: new Date().toISOString().split('T')[0],
  due_date: '', client_id: '', status: 'pending', iss_rate: '5', simples_rate: '6', notes: '',
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [invRes, cliRes] = await Promise.all([
      supabase.from('invoices').select('*, client:clients(name)').eq('user_id', user.id).order('issue_date', { ascending: false }),
      supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
    ])
    setInvoices(invRes.data ?? [])
    setClients(cliRes.data ?? [])
    setLoading(false)
  }

  async function save() {
    if (!form.description || !form.amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      number: form.number || null,
      description: form.description,
      amount: parseFloat(form.amount),
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      client_id: form.client_id || null,
      status: form.status,
      iss_rate: parseFloat(form.iss_rate) / 100,
      simples_rate: parseFloat(form.simples_rate) / 100,
      notes: form.notes || null,
    }

    if (editingId) {
      await supabase.from('invoices').update(payload).eq('id', editingId)
    } else {
      await supabase.from('invoices').insert(payload)
    }

    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY)
    setSaving(false)
    load()
  }

  async function markPaid(id: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', id)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remover esta nota fiscal?')) return
    await supabase.from('invoices').delete().eq('id', id)
    load()
  }

  function openEdit(inv: any) {
    setForm({
      number: inv.number ?? '',
      description: inv.description,
      amount: String(inv.amount),
      issue_date: inv.issue_date,
      due_date: inv.due_date ?? '',
      client_id: inv.client_id ?? '',
      status: inv.status,
      iss_rate: String(Number(inv.iss_rate) * 100),
      simples_rate: String(Number(inv.simples_rate) * 100),
      notes: inv.notes ?? '',
    })
    setEditingId(inv.id)
    setShowModal(true)
  }

  const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus)
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-slate-400 text-sm mb-1">A receber</p>
          <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalPending)}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm mb-1">Recebido (total)</p>
          <p className="text-xl font-bold text-primary-400">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'paid', 'overdue'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${filterStatus === s ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {s === 'all' ? 'Todas' : STATUS_LABELS[s]?.label}
            </button>
          ))}
        </div>
        <button onClick={() => { setForm(EMPTY); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nova NF
        </button>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhuma nota fiscal encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(inv => {
              const st = STATUS_LABELS[inv.status]
              const taxAmount = Number(inv.amount) * Number(inv.simples_rate)
              const issAmount = Number(inv.amount) * Number(inv.iss_rate)
              return (
                <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 hover:bg-slate-800/30">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-slate-100">{inv.description}</p>
                      {inv.number && <span className="text-xs text-slate-500">#{inv.number}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                      {inv.client && <span>{inv.client.name}</span>}
                      <span>Emissão: {formatDate(inv.issue_date)}</span>
                      {inv.due_date && <span>Venc: {formatDate(inv.due_date)}</span>}
                      <span>Simples: {formatCurrency(taxAmount)}</span>
                      <span>ISS: {formatCurrency(issAmount)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.color}`}>{st.label}</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(inv.amount)}</span>
                    <div className="flex gap-1">
                      {inv.status === 'pending' && (
                        <button onClick={() => markPaid(inv.id)} className="p-1.5 text-slate-500 hover:text-primary-400 rounded-lg hover:bg-primary-500/10" title="Marcar como paga">
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      <button onClick={() => openEdit(inv)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700"><Edit2 size={15} /></button>
                      <button onClick={() => remove(inv.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="font-bold text-white">{editingId ? 'Editar' : 'Nova'} Nota Fiscal</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Número da NF (opcional)</label>
                  <input type="text" className="input" placeholder="Ex: 00123" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Descrição do serviço</label>
                <input type="text" className="input" placeholder="Ex: Desenvolvimento de site" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor (R$)</label>
                  <input type="number" step="0.01" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Cliente</label>
                  <select className="input" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                    <option value="">Sem cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Data de emissão</label>
                  <input type="date" className="input" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Vencimento</label>
                  <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Alíquota Simples (%)</label>
                  <input type="number" step="0.01" className="input" value={form.simples_rate} onChange={e => setForm(f => ({ ...f, simples_rate: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Alíquota ISS (%)</label>
                  <input type="number" step="0.01" className="input" value={form.iss_rate} onChange={e => setForm(f => ({ ...f, iss_rate: e.target.value }))} />
                </div>
              </div>
              {form.amount && (
                <div className="bg-slate-800/60 rounded-xl p-3 text-sm space-y-1">
                  <p className="text-slate-400">Valor bruto: <span className="text-white font-medium">{formatCurrency(parseFloat(form.amount) || 0)}</span></p>
                  <p className="text-slate-400">Simples Nacional: <span className="text-red-400 font-medium">- {formatCurrency((parseFloat(form.amount) || 0) * (parseFloat(form.simples_rate) / 100))}</span></p>
                  <p className="text-slate-400">ISS: <span className="text-red-400 font-medium">- {formatCurrency((parseFloat(form.amount) || 0) * (parseFloat(form.iss_rate) / 100))}</span></p>
                  <p className="text-slate-300 font-semibold border-t border-slate-700 pt-1 mt-1">
                    Líquido estimado: {formatCurrency((parseFloat(form.amount) || 0) * (1 - parseFloat(form.simples_rate) / 100 - parseFloat(form.iss_rate) / 100))}
                  </p>
                </div>
              )}
              <div>
                <label className="label">Observações</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={18} className="animate-spin" />}
                {editingId ? 'Salvar' : 'Criar nota fiscal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
