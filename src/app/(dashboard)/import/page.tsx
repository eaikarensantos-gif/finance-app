'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { parseNubankCSV, type ParsedTransaction } from '@/lib/parsers/nubank'
import { guessCategory } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { Account, Category } from '@/types'
import {
  Upload, FileText, CheckCircle2, XCircle, AlertCircle,
  Loader2, ChevronDown, ChevronUp, X
} from 'lucide-react'
import { useEffect } from 'react'

interface ReviewRow extends ParsedTransaction {
  selected: boolean
  category_id: string
  account_id: string
  guessedCategory: string
}

export default function ImportPage() {
  const supabase = createClient()
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [detectedProfile, setDetectedProfile] = useState<'pf' | 'pj' | 'unknown'>('unknown')
  const [selectAll, setSelectAll] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [accRes, catRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('categories').select('*').or(`user_id.eq.${user.id},is_default.eq.true`).order('name'),
    ])
    setAccounts(accRes.data ?? [])
    setCategories(catRes.data ?? [])
    if (accRes.data?.length) setDefaultAccountId(accRes.data[0].id)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setErrors(['Apenas arquivos .csv são suportados no momento.'])
      return
    }
    setParsing(true)
    setFileName(file.name)

    // Garante categorias e contas carregadas
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [accRes, catRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('categories').select('*').or(`user_id.eq.${user.id},is_default.eq.true`).order('name'),
    ])
    const freshAccounts = accRes.data ?? []
    const freshCategories = catRes.data ?? []
    setAccounts(freshAccounts)
    setCategories(freshCategories)
    const accId = defaultAccountId || freshAccounts[0]?.id || ''
    if (accId) setDefaultAccountId(accId)

    const text = await file.text()
    const result = parseNubankCSV(text)
    setDetectedProfile(result.detectedProfile)
    setErrors(result.errors)

    // Auto-categorizar com dados frescos
    const reviewed: ReviewRow[] = result.transactions.map(tx => {
      const guessed = guessCategory(tx.description)
      const cat = freshCategories.find(c =>
        c.name.toLowerCase() === guessed.toLowerCase() && c.type === tx.type
      )
      return {
        ...tx,
        selected: true,
        category_id: cat?.id ?? '',
        account_id: accId,
        guessedCategory: guessed,
      }
    })

    setRows(reviewed)
    setParsing(false)
    setStep('review')
  }

  async function handleImport() {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) return
    setImporting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const toInsert = selected.map(r => ({
      user_id: user.id,
      type: r.type,
      amount: Math.abs(r.amount),
      description: r.description,
      date: r.date,
      category_id: r.category_id || null,
      account_id: r.account_id || null,
      source: 'import',
    }))

    const { error } = await supabase.from('transactions').insert(toInsert)

    if (!error) {
      // Atualiza saldos das contas
      const byAccount: Record<string, number> = {}
      selected.forEach(r => {
        if (!r.account_id) return
        byAccount[r.account_id] = (byAccount[r.account_id] ?? 0) + r.amount
      })
      for (const [accId, delta] of Object.entries(byAccount)) {
        const acc = accounts.find(a => a.id === accId)
        if (acc) {
          await supabase.from('accounts').update({ balance: acc.balance + delta }).eq('id', accId)
        }
      }
    }

    setImportedCount(selected.length)
    setImporting(false)
    setStep('done')
  }

  function toggleAll() {
    const next = !selectAll
    setSelectAll(next)
    setRows(r => r.map(row => ({ ...row, selected: next })))
  }

  const selectedCount = rows.filter(r => r.selected).length

  // STEP: UPLOAD
  if (step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Importar Extrato</h2>
          <p className="text-slate-400 text-sm">Arraste o arquivo CSV exportado do Nubank (NuConta PF ou PJ)</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
            dragging ? 'border-primary-500 bg-primary-500/10' : 'border-slate-700 hover:border-slate-500'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={40} className="animate-spin text-primary-400" />
              <p className="text-slate-300">Processando arquivo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={40} className="text-slate-500" />
              <p className="text-slate-300 font-medium">Clique ou arraste o arquivo aqui</p>
              <p className="text-slate-500 text-sm">Suporta CSV do Nubank NuConta (PF e PJ)</p>
            </div>
          )}
          <input id="file-input" type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
        </div>

        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
            {errors.map((e, i) => <p key={i} className="text-red-400 text-sm">{e}</p>)}
          </div>
        )}

        {/* Instruções */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">Como exportar do Nubank</h3>
          <ol className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><span className="text-primary-400 font-bold">1.</span> Abra o app do Nubank</li>
            <li className="flex gap-2"><span className="text-primary-400 font-bold">2.</span> Vá em <strong className="text-slate-300">Minha Conta → Ver extrato completo</strong></li>
            <li className="flex gap-2"><span className="text-primary-400 font-bold">3.</span> Clique no ícone de compartilhar / exportar (canto superior)</li>
            <li className="flex gap-2"><span className="text-primary-400 font-bold">4.</span> Escolha <strong className="text-slate-300">Exportar CSV</strong></li>
            <li className="flex gap-2"><span className="text-primary-400 font-bold">5.</span> Repita para a conta PJ se necessário</li>
          </ol>
        </div>
      </div>
    )
  }

  // STEP: REVIEW
  if (step === 'review') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Revisar Transações</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              <FileText size={14} className="inline mr-1" />
              {fileName} · {rows.length} transações encontradas
              {detectedProfile !== 'unknown' && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                  detectedProfile === 'pj' ? 'bg-blue-500/20 text-blue-400' : 'bg-primary-500/20 text-primary-400'
                }`}>
                  {detectedProfile === 'pj' ? 'PJ detectado' : 'PF detectado'}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('upload')} className="btn-secondary flex items-center gap-2">
              <X size={16} /> Cancelar
            </button>
            <button
              onClick={handleImport}
              className="btn-primary flex items-center gap-2"
              disabled={importing || selectedCount === 0}
            >
              {importing && <Loader2 size={16} className="animate-spin" />}
              Importar {selectedCount} transações
            </button>
          </div>
        </div>

        {/* Configuração padrão */}
        <div className="card flex flex-wrap gap-4">
          <div className="flex-1 min-w-48">
            <label className="label">Conta padrão</label>
            <select
              className="input"
              value={defaultAccountId}
              onChange={e => {
                setDefaultAccountId(e.target.value)
                setRows(r => r.map(row => ({ ...row, account_id: e.target.value })))
              }}
            >
              <option value="">Sem conta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabela de review */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-800/50">
            <input type="checkbox" checked={selectAll} onChange={toggleAll} className="w-4 h-4 accent-primary-500" />
            <span className="text-xs text-slate-400 font-medium">{selectedCount} de {rows.length} selecionadas</span>
          </div>
          <div className="divide-y divide-slate-800 max-h-[60vh] overflow-y-auto">
            {rows.map((row, i) => (
              <div key={i} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${!row.selected ? 'opacity-40' : ''}`}>
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                  className="w-4 h-4 accent-primary-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{row.description}</p>
                  <p className="text-xs text-slate-500">{row.date}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${row.type === 'income' ? 'text-primary-400' : 'text-red-400'}`}>
                  {row.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(row.amount))}
                </span>
                <select
                  className="input text-xs py-1.5 w-40 shrink-0"
                  value={row.category_id}
                  onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, category_id: e.target.value } : x))}
                >
                  <option value="">Sem categoria</option>
                  {categories.filter(c => c.type === row.type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  className="input text-xs py-1.5 w-36 shrink-0"
                  value={row.account_id}
                  onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, account_id: e.target.value } : x))}
                >
                  <option value="">Sem conta</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // STEP: DONE
  return (
    <div className="max-w-md mx-auto text-center space-y-6 mt-12">
      <CheckCircle2 size={64} className="mx-auto text-primary-400" />
      <div>
        <h2 className="text-2xl font-bold text-white">Importação concluída!</h2>
        <p className="text-slate-400 mt-2">{importedCount} transações importadas com sucesso.</p>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => { setStep('upload'); setRows([]) }} className="btn-secondary">
          Importar outro arquivo
        </button>
        <a href="/transactions" className="btn-primary">Ver transações</a>
      </div>
    </div>
  )
}
