'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="card shadow-2xl shadow-black/50">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Bem-vinda de volta 👋</h2>
        <p className="text-slate-400 text-sm mt-1">Entre com sua conta para continuar</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Senha</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input pr-10"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm flex items-center gap-2">
            <span className="text-base">⚠️</span> {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center">
        <p className="text-slate-400 text-sm">
          Não tem conta?{' '}
          <Link href="/register" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
