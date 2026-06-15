import { AuthGuard } from '@/components/layout/AuthGuard'
import { BottomNav } from '@/components/layout/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="pb-20 min-h-screen">
        {children}
      </div>
      <BottomNav />
    </AuthGuard>
  )
}
