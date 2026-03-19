export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/20 rounded-2xl mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-white">FinanceApp</h1>
          <p className="text-slate-400 text-sm mt-1">Controle suas finanças com inteligência</p>
        </div>
        {children}
      </div>
    </div>
  )
}
