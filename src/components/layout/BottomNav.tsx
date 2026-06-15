'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CreditCard, Upload, TrendingUp, BarChart2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'ראשי', Icon: Home },
  { href: '/transactions', label: 'עסקאות', Icon: CreditCard },
  { href: '/import', label: 'ייבוא', Icon: Upload },
  { href: '/investments', label: 'השקעות', Icon: TrendingUp },
  { href: '/reports', label: 'דוחות', Icon: BarChart2 },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-slate-700 flex">
      {navItems.map(({ href, label, Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs transition-colors
              ${isActive ? 'text-accent' : 'text-slate-400'}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
