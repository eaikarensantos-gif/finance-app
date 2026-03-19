'use client'

import { Menu, Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-4 py-4 flex items-center justify-between lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-slate-400 hover:text-white"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-bold text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <Bell size={18} />
        </button>
      </div>
    </header>
  )
}
