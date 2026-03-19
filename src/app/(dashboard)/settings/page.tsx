'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Account } from '@/types'
import { Loader2, MessageCircle, CheckCircle2, Copy } from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [settings, setSettings] = useState({
    whatsapp_number: '',
    default_account_id: '',
  })
  const [user, setUser] = useState<any>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const botUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://seu-app.vercel.app'}/api/whatsapp`

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const [accRes, settingsRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
    ])

    setAccounts(accRes.data ?? [])
    if (settingsRes.data) {
      setSettings({
        whatsapp_number: settingsRes.data.whatsapp_number ?? '',
        default_account_id: settingsRes.data.default_account_id ?? '',
      })
    }
    setLoading(false)
  }

  async function saveSettings() {
    if (!user) return
    setSaving(true)

    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase.from('user_settings').update({
        whatsapp_number: settings.whatsapp_number || null,
        default_account_id: settings.default_account_id || null,
      }).eq('user_id', user.id)
    } else {
      await supabase.from('user_settings').insert({
        user_id: user.id,
        whatsapp_number: settings.whatsapp_number || null,
        default_account_id: settings.default_account_id || null,
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function copyBotUrl() {
    navigator.clipboard.writeText(botUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-primary-400" /></div>
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Conta */}
      <div className="card">
        <h2 className="text-base font-bold text-white mb-4">Minha Conta</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={user?.email ?? ''} disabled />
          </div>
        </div>
      </div>

      {/* Configurações gerais */}
      <div className="card">
        <h2 className="text-base font-bold text-white mb-4">Preferências</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Conta padrão (para o bot WhatsApp)</label>
            <select className="input" value={settings.default_account_id} onChange={e => setSettings(s => ({ ...s, default_account_id: e.target.value }))}>
              <option value="">Sem conta padrão</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle size={20} className="text-primary-400" />
          <h2 className="text-base font-bold text-white">Integração WhatsApp</h2>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 mb-5 text-sm text-slate-400 space-y-2">
          <p className="font-medium text-slate-300">Como usar o bot:</p>
          <ul className="space-y-1 ml-2">
            <li>• <code className="text-primary-400">gastei 50 no mercado</code> → registra despesa</li>
            <li>• <code className="text-primary-400">recebi 1000 de salário</code> → registra receita</li>
            <li>• <code className="text-primary-400">resumo</code> → saldo e resumo do mês</li>
            <li>• <code className="text-primary-400">ajuda</code> → lista de comandos</li>
          </ul>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Seu número WhatsApp (com código do país)</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: 5511999999999"
              value={settings.whatsapp_number}
              onChange={e => setSettings(s => ({ ...s, whatsapp_number: e.target.value.replace(/\D/g, '') }))}
            />
            <p className="text-xs text-slate-500 mt-1">Apenas números, sem espaços ou símbolos. Ex: 5511999999999</p>
          </div>

          <div>
            <label className="label">URL do Webhook (para configurar no bot)</label>
            <div className="flex gap-2">
              <input type="text" className="input font-mono text-xs" value={botUrl} readOnly />
              <button onClick={copyBotUrl} className="btn-secondary flex items-center gap-1.5 shrink-0">
                {copied ? <CheckCircle2 size={16} className="text-primary-400" /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Configure esta URL no arquivo <code>.env</code> do bot WhatsApp.</p>
          </div>
        </div>
      </div>

      {/* Instruções deploy do bot */}
      <div className="card">
        <h2 className="text-base font-bold text-white mb-4">Configurar o Bot WhatsApp</h2>
        <div className="space-y-3 text-sm text-slate-400">
          <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-xs space-y-1">
            <p className="text-slate-300 font-sans font-medium mb-2">1. Na pasta <code>whatsapp-bot/</code>:</p>
            <p className="text-slate-400">cp .env.example .env</p>
            <p className="text-slate-400">npm install</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-xs space-y-1">
            <p className="text-slate-300 font-sans font-medium mb-2">2. Preencha o <code>.env</code>:</p>
            <p className="text-slate-400">APP_URL={botUrl}</p>
            <p className="text-slate-400">BOT_SECRET=sua_chave_secreta</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-xs space-y-1">
            <p className="text-slate-300 font-sans font-medium mb-2">3. Inicie e escaneie o QR code:</p>
            <p className="text-slate-400">npm start</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 font-mono text-xs space-y-1">
            <p className="text-slate-300 font-sans font-medium mb-2">4. Deploy no Railway (grátis):</p>
            <p className="text-slate-400">railway up</p>
          </div>
        </div>
      </div>

      <button onClick={saveSettings} className="btn-primary flex items-center gap-2" disabled={saving}>
        {saving && <Loader2 size={18} className="animate-spin" />}
        {saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  )
}
