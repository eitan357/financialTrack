'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface Pos {
  top: number
  left: number
  minWidth: number
  maxHeight: number
}

export function useDropdownPortal() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0, minWidth: 0, maxHeight: 300 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: Event) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const toggle = useCallback(() => {
    setOpen(v => {
      if (!v && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom - 8
        setPos({
          top: rect.bottom + 4,
          left: rect.left,
          minWidth: rect.width,
          maxHeight: Math.max(120, Math.min(spaceBelow, 220)),
        })
      }
      return !v
    })
  }, [])

  const renderPortal = useCallback((children: ReactNode) => {
    if (!open || typeof document === 'undefined') return null
    return createPortal(
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          minWidth: pos.minWidth,
          maxWidth: 320,
          maxHeight: pos.maxHeight,
          zIndex: 9999,
          overflow: 'hidden',
          borderRadius: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)',
        }}
      >
        {children}
      </div>,
      document.body
    )
  }, [open, pos])

  return { open, setOpen, triggerRef, dropdownRef, toggle, renderPortal }
}
