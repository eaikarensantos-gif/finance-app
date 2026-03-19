'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Goal } from '@/types'
import { Plus, Trash2, Edit2, X, Loader2, Target, CheckCircle2 } from 'lucide-react'

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#f59e0b', '#ef4444']
const EMPTY_FORM = { name: '', target_amount: '', current_amount: '0', deadline: '', color: '#22c55e' }

export default function GoalsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setGoals(data ?? [])
    setLoading(false)
  }

  async function save() {
    if (!form.name || !form.target_amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const current = parseFloat(form.current_amount) || 0
    const target = parseFloat(form.target_amount)
    const payload = {
      user_id: user.id,
      name: form.name,
      target_amount: target,
      current_amount: current,
      deadline: form.deadline || null,
      color: form.color,
      completed: current >= target,
    }

    if (editingId) {
      await supabase.from('goals').update(payload).eq('id', editingId)
    } else {
      await supabase.from('goals').insert(payload)
    }

    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remover esta meta?')) return
    await supabase.from('goals').delete().eq('id', id)
    load()
  }

  async function addDeposit(goal: Goal) {
    const val = prompt(`Adicionar quanto à meta "${goal.name}"? (R$)`)
    if (!val) return
    const amount = parseFloat(val.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) return
    const newCurrent = goal.current_amount + amount
    await supabase.from('goals').update({
      current_amount: newCurrent,
      completed: newCurrent >= goal.target_amount,
    }).eq('id', goal.id)
    load()
  }

  function openEdit(goal: Goal) {
    setForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      deadline: goal.deadline ?? '',
      color: goal.color,
    })
    setEditingId(goal.id)
    setShowModal(true)
  }

  const activeGoals = goals.filter(g => !g.completed)
  const completedGoals = goals.filter(g => g.completed)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">{activeGoals.length} meta{activeGoals.length !== 1 ? 's' : ''} ativa{activeGoals.length !== 1 ? 's' : ''}</span>
          {completedGoals.length > 0 && (
            <button onClick={() => setShowCompleted(!showCompleted)} className="text-primary-400 text-sm hover:text-primary-300">
              {showCompleted ? 'Ocultar' : `Ver ${completedGoals.length} concluída${completedGoals.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nova Meta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...activeGoals, ...(showCompleted ? completedGoals : [])].map(goal => {
            const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100)
            const remaining = goal.target_amount - goal.current_amount
            return (
              <div key={goal.id} className={`card group relative ${goal.completed ? 'opacity-70' : ''}`}>
                {goal.completed && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 size={20} className="text-primary-400" />
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color}20` }}>
                      <Target size={20} style={{ color: goal.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{goal.name}</p>
                      {goal.deadline && <p className="text-xs text-slate-500">Prazo: {formatDate(goal.deadline)}</p>}
                    </div>
                  </div>
                  {!goal.completed && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(goal)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700"><Edit2 size={14} /></button>
                      <button onClick={() => remove(goal.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-100 font-medium">{formatCurrency(goal.current_amount)}</span>
                    <span className="text-slate-400">{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{Math.round(pct)}% concluído</span>
                    {!goal.completed && <span>Faltam {formatCurrency(remaining)}</span>}
                  </div>
                </div>

                {!goal.completed && (
                  <button onClick={() => addDeposit(goal)} className="w-full py-2 rounded-xl text-sm font-medium transition-colors border border-slate-700 hover:border-primary-500 hover:text-primary-400 text-slate-400">
                    + Adicionar valor
                  </button>
                )}
              </div>
            )
          })}

          {goals.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <Target size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma meta criada.</p>
              <p className="text-sm mt-1">Crie metas para acompanhar seus objetivos financeiros.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">{editingId ? 'Editar' : 'Nova'} Meta</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nome da meta</label>
                <input type="text" className="input" placeholder="Ex: Viagem, Reserva de emergência..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Valor alvo (R$)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Valor atual (R$)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Prazo (opcional)</label>
                <input type="date" className="input" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
                {saving && <Loader2 size={18} className="animate-spin" />}
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
