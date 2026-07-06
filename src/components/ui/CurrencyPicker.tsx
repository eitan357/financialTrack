'use client'
import { useState } from 'react'
import { CURRENCIES, getCurrency } from '@/lib/currencies'
import { useDropdownPortal } from '@/hooks/useDropdownPortal'

interface Props {
  value: string
  onChange: (code: string) => void
  className?: string
}

export function CurrencyPicker({ value, onChange, className = '' }: Props) {
  const [search, setSearch] = useState('')
  const { open, setOpen, triggerRef, toggle, renderPortal } = useDropdownPortal()

  const selected = getCurrency(value)

  const filtered = search.trim()
    ? CURRENCIES.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.symbol.includes(search)
      )
    : CURRENCIES

  function select(code: string) {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
      >
        <span>{selected.symbol}</span>
        <span className="text-xs text-slate-300">{selected.code}</span>
        <span className="text-xs text-slate-500">▾</span>
      </button>

      {renderPortal(
        <div dir="ltr" className="bg-slate-800 border border-slate-700 flex flex-col flex-1 min-h-0">
          <div className="p-2 border-b border-slate-700 flex-shrink-0">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש מטבע..."
              className="w-full bg-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ring-accent"
            />
          </div>
          <ul className="overflow-y-auto flex-1 min-h-0" role="listbox">
            {filtered.map(c => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value}
                onClick={() => select(c.code)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-700 text-sm ${c.code === value ? 'bg-slate-700/60' : ''}`}
              >
                <span className="w-6 text-center flex-shrink-0">{c.symbol}</span>
                <span className="font-mono text-xs text-slate-400 w-10 flex-shrink-0">{c.code}</span>
                <span className="text-slate-300 truncate">{c.name}</span>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-slate-500 text-sm text-center">לא נמצא מטבע</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
