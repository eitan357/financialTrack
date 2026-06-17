'use client'
import { useState, useCallback, useEffect } from 'react'

function currentMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

const KEY = 'ft_month'

export function usePersistedMonth(): [string, (m: string) => void] {
  const [month, setMonthState] = useState(currentMonth)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored) setMonthState(stored)
  }, [])

  const setMonth = useCallback((m: string) => {
    setMonthState(m)
    localStorage.setItem(KEY, m)
  }, [])

  return [month, setMonth]
}
