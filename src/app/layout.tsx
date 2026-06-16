import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
})

export const metadata: Metadata = {
  title: 'Financial Track',
  description: 'מעקב פיננסי חודשי',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} font-sans`}>
      <body className="bg-background min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
