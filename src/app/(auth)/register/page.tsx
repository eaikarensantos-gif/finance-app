'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Criar conta padrão e configurações
    if (data.user) {
      await supabase.from('accounts').insert({
        user_id: data.user.id,
        name: 'Carteira',
        type: 'cash',
        balance: 0,
        color: '#22c55e',
        icon: 'wallet',
      })
      await supabase.from('user_settings').insert({
        user_id: data.user.id,
      })
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <div className="card text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-white mb-2">Conta criada!</h2>
        <p className="text-slate-400">Redirecionando para o dashboard...</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-white mb-6">Criar conta grátis</h2>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="label">Nome</label>
          <input
            type="text"
            className="input"
            placeholder="Seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

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
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-slate-400 text-sm mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary-400 hover:text-primary-300 font-medium">
          Entrar
        </Link>
      </p>
    </div>
  )
}
