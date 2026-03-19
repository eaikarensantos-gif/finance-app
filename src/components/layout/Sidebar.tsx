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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-slate-950 border-r border-slate-800/60 z-30 flex flex-col transition-transform duration-300',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500/20 border border-primary-500/30 rounded-xl flex items-center justify-center">
              <TrendingUp size={16} className="text-primary-400" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">FinanceApp</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* PF section label */}
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 pb-2 pt-1">Pessoal</p>

          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                  active
                    ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
                )}>
                <Icon size={16} className={active ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
                {label}
              </Link>
            )
          })}

          {/* PJ Section */}
          <div className="pt-3">
            <button
              onClick={() => setPjOpen(!pjOpen)}
              className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Building2 size={11} />
                Pessoa Jurídica
              </span>
              <ChevronDown size={12} className={cn('transition-transform duration-200', pjOpen ? 'rotate-180' : '')} />
            </button>

            {pjOpen && (
              <div className="space-y-0.5 mt-0.5">
                {pjItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link key={href} href={href} onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                        active
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
                      )}>
                      <Icon size={16} className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-0.5 border-t border-slate-800/60 pt-3">
          <Link href="/settings" onClick={onClose}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border',
              pathname === '/settings'
                ? 'bg-primary-500/15 text-primary-400 border-primary-500/20'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-transparent'
            )}>
            <Settings size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            Configurações
          </Link>

          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 w-full border border-transparent">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
