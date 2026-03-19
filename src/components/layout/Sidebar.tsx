'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Target,
  BarChart3, Settings, LogOut, X, TrendingUp,
  Upload, Zap, Building2, FileText, Users, Landmark, DollarSign, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Contas', icon: Wallet },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/insights', label: 'Insights', icon: Zap },
  { href: '/import', label: 'Importar Extrato', icon: Upload },
]

const pjItems = [
  { href: '/pj/dashboard', label: 'Dashboard PJ', icon: Building2 },
  { href: '/pj/invoices', label: 'Notas Fiscais', icon: FileText },
  { href: '/pj/clients', label: 'Clientes', icon: Users },
  { href: '/pj/dre', label: 'DRE', icon: DollarSign },
  { href: '/pj/taxes', label: 'Impostos / DAS', icon: Landmark },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [pjOpen, setPjOpen] = useState(pathname.startsWith('/pj'))

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-30 flex flex-col transition-transform duration-300',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-primary-400" />
            </div>
            <span className="text-lg font-bold text-white">FinanceApp</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* PF */}
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-primary-500/20 text-primary-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}>
                <Icon size={18} />
                {label}
              </Link>
            )
          })}

          {/* PJ Section */}
          <div className="pt-2">
            <button
              onClick={() => setPjOpen(!pjOpen)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
            >
              <span className="flex items-center gap-2"><Building2 size={14} /> Pessoa Jurídica</span>
              <ChevronDown size={14} className={cn('transition-transform', pjOpen ? 'rotate-180' : '')} />
            </button>

            {pjOpen && pjItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link key={href} href={href} onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    active ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  )}>
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Settings */}
          <div className="pt-2">
            <Link href="/settings" onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                pathname === '/settings' ? 'bg-primary-500/20 text-primary-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}>
              <Settings size={18} />
              Configurações
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
