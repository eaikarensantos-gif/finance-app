export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left side — branding (desktop only) */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-12 overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 via-slate-900 to-slate-950" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-primary-500/20 border border-primary-500/30 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <span className="text-2xl font-bold text-white">FinanceApp</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Controle total das suas finanças
          </h2>
          <p className="text-slate-400 mb-10">
            Dashboard inteligente, integração com WhatsApp e módulo PJ completo.
          </p>

          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: '📊', title: 'Dashboard completo', desc: 'Gráficos, metas e relatórios mensais' },
              { icon: '💬', title: 'WhatsApp integrado', desc: 'Registre gastos direto pelo chat' },
              { icon: '🏢', title: 'Módulo PJ', desc: 'NFS-e, DRE e Simples Nacional' },
            ].map(f => (
              <div key={f.title} className="flex items-center gap-4 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950 lg:bg-slate-950/50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-500/20 border border-primary-500/20 rounded-2xl mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h1 className="text-2xl font-bold text-white">FinanceApp</h1>
            <p className="text-slate-400 text-sm mt-1">Controle suas finanças com inteligência</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
