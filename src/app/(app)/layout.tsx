import Link from 'next/link'
import { Settings } from 'lucide-react'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { BottomNav } from '@/components/layout/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <header className="fixed top-0 inset-x-0 h-10 z-40 flex items-center justify-end px-3 pointer-events-none">
        <Link href="/settings" aria-label="הגדרות" className="pointer-events-auto p-1.5 text-slate-500 hover:text-foreground transition-colors">
          <Settings size={18} />
        </Link>
      </header>
      <div className="pt-10 pb-20 min-h-screen">
        {children}
      </div>
      <BottomNav />
    </AuthGuard>
  )
}
