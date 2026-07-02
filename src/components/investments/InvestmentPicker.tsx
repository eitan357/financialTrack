'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { Account, InvestmentType } from '@/lib/types'

export interface InvestmentSelection {
  portfolioAccountId: string
  investmentTypeId?: string
}

interface Props {
  portfolios: Account[]
  types: InvestmentType[]
  value: InvestmentSelection | null
  onChange: (val: InvestmentSelection | null) => void
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function InvestmentPicker({
  portfolios,
  types,
  value,
  onChange,
  placeholder = 'בחר השקעה או תיק',
  disabled = false,
  size = 'md',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activePortfolios = portfolios.filter(p => p.isActive !== false)
  const activeTypes = types.filter(t => t.isActive !== false)

  type Option =
    | { kind: 'portfolio'; portfolio: Account }
    | { kind: 'type'; type: InvestmentType; portfolio: Account }

  const allOptions: Option[] = []
  for (const p of activePortfolios) {
    allOptions.push({ kind: 'portfolio', portfolio: p })
    for (const t of activeTypes.filter(t => t.portfolioAccountId === p.id)) {
      allOptions.push({ kind: 'type', type: t, portfolio: p })
    }
  }

  const q = search.toLowerCase()
  const filtered = q
    ? allOptions.filter(o => {
        if (o.kind === 'portfolio') return o.portfolio.name.toLowerCase().includes(q)
        return o.type.name.toLowerCase().includes(q) || o.portfolio.name.toLowerCase().includes(q)
      })
    : allOptions

  function getLabel(): string {
    if (!value) return ''
    if (value.investmentTypeId) {
      const t = activeTypes.find(t => t.id === value.investmentTypeId)
      const p = activePortfolios.find(p => p.id === value.portfolioAccountId)
      return t ? `${t.name}${p ? ' — ' + p.name : ''}` : ''
    }
    return activePortfolios.find(p => p.id === value.portfolioAccountId)?.name ?? ''
  }

  function select(sel: InvestmentSelection) {
    onChange(sel)
    setOpen(false)
    setSearch('')
  }

  const isSmall = size === 'sm'
  const triggerCls = `w-full flex items-center justify-between bg-background rounded${isSmall ? '' : '-lg'} border border-slate-700 hover:border-slate-500 disabled:opacity-50 ${isSmall ? 'px-1 py-0.5 text-xs' : 'px-3 py-1.5 text-sm'}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={triggerCls}
        aria-label={placeholder}
      >
        <span className={`truncate ${value ? 'text-purple-400' : 'text-slate-500'}`}>
          {value ? getLabel() : placeholder}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0 mr-1">
          {value && (
            <span
              role="button"
              title="נקה"
              onClick={e => { e.stopPropagation(); onChange(null) }}
              className="text-slate-400 hover:text-foreground p-0.5"
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown size={10} className="text-slate-400" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-40 w-max max-w-64 bg-surface border border-slate-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-slate-700">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש..."
              className="w-full bg-background text-xs px-2 py-1 rounded outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-3">לא נמצא</p>
            )}
            {filtered.map((o, idx) => {
              if (o.kind === 'portfolio') {
                const sel = value?.portfolioAccountId === o.portfolio.id && !value?.investmentTypeId
                return (
                  <button
                    key={`p-${o.portfolio.id}-${idx}`}
                    type="button"
                    onClick={() => select({ portfolioAccountId: o.portfolio.id })}
                    className={`w-full text-right px-3 py-1.5 text-xs hover:bg-slate-800 font-medium ${sel ? 'text-accent' : 'text-foreground'}`}
                  >
                    {o.portfolio.name}
                  </button>
                )
              }
              const sel = value?.investmentTypeId === o.type.id
              return (
                <button
                  key={`t-${o.type.id}-${idx}`}
                  type="button"
                  onClick={() => select({ portfolioAccountId: o.portfolio.id, investmentTypeId: o.type.id })}
                  className={`w-full text-right px-3 pr-5 py-1 text-xs hover:bg-slate-800 ${sel ? 'text-accent' : 'text-slate-300'}`}
                >
                  {o.type.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
