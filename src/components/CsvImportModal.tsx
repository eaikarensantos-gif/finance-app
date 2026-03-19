'use client'

import { useState, useRef } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react'

interface CsvImportModalProps {
  title: string
  expectedColumns: string[]
  columnLabels: Record<string, string>
  onImport: (rows: Record<string, string>[]) => Promise<{ success: number; errors: number }>
  onClose: () => void
  templateRow?: Record<string, string>
}

export default function CsvImportModal({ title, expectedColumns, columnLabels, onImport, onClose, templateRow }: CsvImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload')
  const [result, setResult] = useState({ success: 0, errors: 0 })
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function parseCSV(text: string) {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }

    const parseRow = (line: string) => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; continue }
        if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
        if (line[i] === ';' && !inQuotes) { result.push(current.trim()); current = ''; continue }
        current += line[i]
      }
      result.push(current.trim())
      return result
    }

    const hdrs = parseRow(lines[0])
    const data = lines.slice(1).map(line => {
      const values = parseRow(line)
      const row: Record<string, string> = {}
      hdrs.forEach((h, i) => { row[h] = values[i] ?? '' })
      return row
    }).filter(r => Object.values(r).some(v => v))

    return { headers: hdrs, rows: data }
  }

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: hdrs, rows: data } = parseCSV(text)
      setHeaders(hdrs)
      setRows(data)
      // Auto-map columns
      const autoMap: Record<string, string> = {}
      expectedColumns.forEach(col => {
        const match = hdrs.find(h =>
          h.toLowerCase().includes(col.toLowerCase()) ||
          col.toLowerCase().includes(h.toLowerCase()) ||
          (columnLabels[col] && h.toLowerCase().includes(columnLabels[col].toLowerCase()))
        )
        if (match) autoMap[col] = match
      })
      setMapping(autoMap)
      setStep('map')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const mappedRows = rows.map(row => {
    const mapped: Record<string, string> = {}
    expectedColumns.forEach(col => {
      mapped[col] = mapping[col] ? row[mapping[col]] ?? '' : ''
    })
    return mapped
  })

  async function handleImport() {
    setLoading(true)
    const res = await onImport(mappedRows)
    setResult(res)
    setStep('done')
    setLoading(false)
  }

  function downloadTemplate() {
    const headers = expectedColumns.map(c => columnLabels[c] ?? c).join(',')
    const example = templateRow ? expectedColumns.map(c => templateRow[c] ?? '').join(',') : ''
    const csv = [headers, example].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${title.toLowerCase().replace(/\s/g, '_')}.csv`
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Upload size={18} className="text-primary-400" /> Importar {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-primary-500/50 rounded-2xl p-10 text-center cursor-pointer transition-colors"
              >
                <FileText size={40} className="mx-auto mb-3 text-slate-600" />
                <p className="text-slate-300 font-medium">Arraste um arquivo CSV aqui</p>
                <p className="text-slate-500 text-sm mt-1">ou clique para selecionar</p>
                <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
              <button onClick={downloadTemplate} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                <FileText size={14} /> Baixar modelo CSV
              </button>
              <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400">
                <p className="font-semibold text-slate-300 mb-1">Colunas esperadas:</p>
                <p>{expectedColumns.map(c => columnLabels[c] ?? c).join(', ')}</p>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-300 text-sm font-medium">Arquivo: <span className="text-primary-400">{fileName}</span> — {rows.length} linha{rows.length !== 1 ? 's' : ''}</p>
              </div>
              <p className="text-slate-400 text-sm">Mapeie as colunas do seu arquivo:</p>
              <div className="space-y-2">
                {expectedColumns.map(col => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="text-sm text-slate-300 w-36 flex-shrink-0">{columnLabels[col] ?? col}</span>
                    <select
                      className="input text-sm"
                      value={mapping[col] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                    >
                      <option value="">— ignorar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('preview')} className="btn-primary w-full">
                Pré-visualizar ({rows.length} registros)
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">{mappedRows.length} registros prontos para importar:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 sticky top-0">
                    <tr>
                      {expectedColumns.map(col => (
                        <th key={col} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">
                          {columnLabels[col] ?? col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mappedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        {expectedColumns.map(col => (
                          <td key={col} className="px-3 py-2 text-slate-300 max-w-[150px] truncate">
                            {row[col] || <span className="text-slate-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mappedRows.length > 20 && <p className="text-slate-500 text-xs text-center">+ {mappedRows.length - 20} registros não exibidos</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep('map')} className="btn-secondary flex-1">Voltar</button>
                <button onClick={handleImport} disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Importando...' : `Importar ${mappedRows.length} registros`}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              {result.success > 0 && (
                <div className="flex items-center justify-center gap-2 text-primary-400">
                  <CheckCircle2 size={24} />
                  <span className="text-lg font-semibold">{result.success} importados com sucesso</span>
                </div>
              )}
              {result.errors > 0 && (
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <AlertCircle size={20} />
                  <span className="text-sm">{result.errors} com erro (ignorados)</span>
                </div>
              )}
              <button onClick={onClose} className="btn-primary px-8 mx-auto block">Concluir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
