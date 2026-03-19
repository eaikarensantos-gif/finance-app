'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Edit2, X, Loader2, Users, Upload } from 'lucide-react'
import CsvImportModal from '@/components/CsvImportModal'

const EMPTY = { name: '', document: '', email: '', phone: '', notes: '' }

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<any[]>([])
  const [clientRevenue, setClientRevenue] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [cliRes, invRes] = await Promise.all([
      supabase.from('clients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('invoices').select('client_id, amount').eq('user_id', user.id).eq('status', 'paid'),
    ])

    setClients(cliRes.data ?? [])

    // Receita por cliente
    const rev: Record<string, number> = {}
    ;(invRes.data ?? []).forEach((i: any) => {
      if (i.client_id) rev[i.client_id] = (rev[i.client_id] ?? 0) + Number(i.amount)
    })
    setClientRevenue(rev)
    setLoading(false)
  }

  async function save() {
    if (!form.name) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = { user_id: user.id, ...form }
    if (editingId) {
      await supabase.from('clients').update(payload).eq('id', editingId)
    } else {
      await supabase.from('clients').insert(payload)
    }

    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY)
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remover este cliente?')) return
    await supabase.from('clients').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-slate-400 text-sm">{clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={16} /> Importar CSV
          </button>
          <button onClick={() => { setForm(EMPTY); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <div key={client.id} className="card group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg font-bold text-blue-400">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setForm({ name: client.name, document: client.document ?? '', email: client.email ?? '', phone: client.phone ?? '', notes: client.notes ?? '' }); setEditingId(client.id); setShowModal(true) }} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700"><Edit2 size={14} /></button>
                  <button onClick={() => remove(client.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="font-semibold text-white">{client.name}</p>
              {client.document && <p className="text-xs text-slate-500 mt-0.5">CNPJ/CPF: {client.document}</p>}
              {client.email && <p className="text-xs text-slate-500">{client.email}</p>}
              {client.phone && <p className="text-xs text-slate-500">{client.phone}</p>}
              {clientRevenue[client.id] > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-400">Total faturado</p>
                  <p className="text-primary-400 font-semibold text-sm">{formatCurrency(clientRevenue[client.id])}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showImport && (
        <CsvImportModal
          title="Clientes"
          expectedColumns={['name', 'document', 'email', 'phone']}
          columnLabels={{ name: 'Nome/Razão Social', document: 'CNPJ/CPF', email: 'Email', phone: 'Telefone' }}
          templateRow={{ name: 'Empresa Exemplo Ltda', document: '00.000.000/0001-00', email: 'contato@empresa.com', phone: '(11) 99999-9999' }}
          onClose={() => { setShowImport(false); load() }}
          onImport={async (rows) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return { success: 0, errors: 0 }
            let success = 0, errors = 0
            for (const row of rows) {
              if (!row.name) { errors++; continue }
              const { error } = await supabase.from('clients').insert({ user_id: user.id, name: row.name, document: row.document || null, email: row.email || null, phone: row.phone || null })
              if (error) errors++; else success++
            }
            return { success, errors }
          }}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="font-bold text-white">{editingId ? 'Editar' : 'Novo'} Cliente</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome / Razão Social</label>
                <input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">CNPJ / CPF</label>
                <input type="text" className="input" placeholder="00.000.000/0000-00" value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input type="text" className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Observações</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={18} className="animate-spin" />}
                {editingId ? 'Salvar' : 'Criar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
