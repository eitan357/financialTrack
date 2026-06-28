'use client'
import { useState, useRef, useEffect } from 'react'

export interface SelectOption {
  value: string
  label: string
  color?: string
  group?: string
}

export interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  nullable?: boolean
  nullLabel?: string
  error?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = 'בחר...',
  nullable = false,
  nullLabel = '— ללא —',
  error = false,
  disabled = false,
  size = 'md',
  className = '',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isSm = size === 'sm'
  const triggerPy = isSm ? 'py-1' : 'py-2'
  const triggerPx = isSm ? 'px-2' : 'px-3'
  const triggerText = isSm ? 'text-xs' : 'text-sm'
  const dropdownWidth = isSm ? 'w-56' : 'w-full min-w-[14rem]'

  function renderGroups() {
    const items: React.ReactNode[] = []

    if (nullable) {
      items.push(
        <li
          key="__null__"
          role="option"
          aria-selected={value === ''}
          onClick={() => { onChange(''); setOpen(false); setSearch('') }}
          className={`px-3 py-2 cursor-pointer hover:bg-slate-700 text-sm text-slate-400 ${value === '' ? 'bg-slate-700/60' : ''}`}
        >
          {nullLabel}
        </li>
      )
    }

    let lastGroup: string | undefined = undefined
    for (const opt of filtered) {
      if (opt.group !== lastGroup) {
        lastGroup = opt.group
        if (opt.group) {
          items.push(
            <li key={`__group__${opt.group}`} className="px-3 pt-2 pb-1 text-xs text-slate-500 font-medium select-none">
              {opt.group}
            </li>
          )
        }
      }
      items.push(
        <li
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          onClick={() => { onChange(opt.value); setOpen(false); setSearch('') }}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-700 text-sm ${opt.value === value ? 'bg-slate-700/60' : ''}`}
        >
          {opt.color && (
            <span className="flex-shrink-0 text-base leading-none" style={{ color: opt.color }}>●</span>
          )}
          <span className="truncate">{opt.label}</span>
        </li>
      )
    }

    if (filtered.length === 0) {
      items.push(
        <li key="__empty__" className="px-3 py-4 text-slate-500 text-sm text-center">לא נמצאו תוצאות</li>
      )
    }

    return items
  }

  const ringClass = error ? 'ring-1 ring-red-500' : open ? 'ring-1 ring-accent' : ''
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-600'

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={`w-full flex items-center gap-2 bg-slate-700 rounded-lg ${triggerPx} ${triggerPy} ${triggerText} transition-colors ${ringClass} ${disabledClass}`}
      >
        {selected?.color && (
          <span className="flex-shrink-0 text-base leading-none" style={{ color: selected.color }}>●</span>
        )}
        <span className={`flex-1 text-right truncate ${!selected ? 'text-slate-500' : 'text-foreground'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-xs text-slate-500 flex-shrink-0">▾</span>
      </button>

      {open && (
        <div dir="ltr" className={`absolute z-50 top-full mt-1 left-0 ${dropdownWidth} bg-slate-800 border border-slate-700 rounded-xl shadow-xl`}>
          <div className="p-2 border-b border-slate-700">
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חפש..."
              className="w-full bg-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 ring-accent"
            />
          </div>
          <ul className="overflow-y-auto max-h-52" role="listbox">
            {renderGroups()}
          </ul>
        </div>
      )}
    </div>
  )
}
