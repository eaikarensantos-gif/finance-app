'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/transactions': 'Transações',
  '/accounts': 'Contas',
  '/goals': 'Metas',
  '/reports': 'Relatórios',
  '/insights': 'Insights',
  '/import': 'Importar Extrato',
  '/settings': 'Configurações',
  '/pj/dashboard': 'Dashboard PJ',
  '/pj/invoices': 'Notas Fiscais',
  '/pj/clients': 'Clientes',
  '/pj/dre': 'DRE',
  '/pj/taxes': 'Impostos e DAS',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? 'FinanceApp'

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-64">
        <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
