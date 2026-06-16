# Financial Track — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js + Firebase project with Google Auth, Hebrew RTL dark theme, and a navigable app shell with placeholder screens.

**Architecture:** Next.js 15 App Router with two route groups — `(auth)` for the login screen and `(app)` for protected screens wrapped with `AuthGuard` and `BottomNav`. Firebase Auth handles Google OAuth. The `useAuth` hook tracks auth state reactively.

**Tech Stack:** Next.js 15 · TypeScript · Firebase Auth + Firestore · Tailwind CSS v3 · Rubik font (Hebrew) · Lucide React icons · Jest 29 + Testing Library

---

## File Map

```
financialTrack/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout: RTL, Hebrew, dark bg, Rubik font
│   │   ├── globals.css                     # CSS variables + Tailwind base
│   │   ├── page.tsx                        # Root → server redirect to /dashboard
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       ├── page.tsx                # Login page (Google OAuth)
│   │   │       └── page.test.tsx           # Tests
│   │   └── (app)/
│   │       ├── layout.tsx                  # Protected layout: AuthGuard + BottomNav
│   │       ├── dashboard/page.tsx          # Placeholder
│   │       ├── transactions/page.tsx       # Placeholder
│   │       ├── import/page.tsx             # Placeholder
│   │       ├── investments/page.tsx        # Placeholder
│   │       └── reports/page.tsx            # Placeholder
│   ├── components/
│   │   └── layout/
│   │       ├── BottomNav.tsx               # Bottom navigation bar (5 items)
│   │       ├── BottomNav.test.tsx
│   │       ├── AuthGuard.tsx               # Redirects unauthenticated users to /login
│   │       └── AuthGuard.test.tsx
│   ├── hooks/
│   │   ├── useAuth.ts                      # Firebase auth state hook
│   │   └── useAuth.test.ts
│   └── lib/
│       ├── firebase/
│       │   ├── config.ts                   # Firebase app init (singleton)
│       │   └── auth.ts                     # signInWithGoogle, signOutUser, auth instance
│       └── types/
│           └── index.ts                    # All Firestore entity TypeScript types
├── .env.local                              # Firebase credentials — NOT committed
├── .env.local.example                      # Template — committed
├── jest.config.ts
├── jest.setup.ts
├── next.config.ts
└── tailwind.config.ts
```

---

### Task 1: Initialize Project + Testing Setup

**Files:**
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `.env.local.example`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Create the Next.js project**

Run in `c:\Users\Eitan\Documents\learning\financialTrack`:
```powershell
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```
When prompted for preferences, choose: **No** for Turbopack (use webpack for stability).

- [ ] **Step 2: Install runtime dependencies**

```powershell
pnpm add firebase lucide-react
```

- [ ] **Step 3: Install testing dependencies**

```powershell
pnpm add -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest
```

- [ ] **Step 4: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test scripts to `package.json`**

In `package.json`, under `"scripts"`, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Create `.env.local.example`**

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 8: Verify tests run (nothing to test yet)**

```powershell
pnpm test --passWithNoTests
```
Expected: passes with 0 test suites.

- [ ] **Step 9: Commit**

```powershell
git init
git add jest.config.ts jest.setup.ts .env.local.example package.json
git commit -m "feat: initialize Next.js project with Jest + Testing Library"
```

---

### Task 2: Firebase Config + TypeScript Types

**Files:**
- Create: `src/lib/firebase/config.ts`
- Create: `src/lib/firebase/auth.ts`
- Create: `src/lib/types/index.ts`
- Create: `.env.local` (from template, fill in credentials)

- [ ] **Step 1: Enable Google Auth in Firebase Console**

Go to [Firebase Console](https://console.firebase.google.com) → your project → Authentication → Sign-in method → Enable Google.

- [ ] **Step 2: Create `.env.local`**

Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials from Firebase Console → Project Settings → Your apps → Web app config:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

- [ ] **Step 3: Create `src/lib/firebase/config.ts`**

```typescript
import { initializeApp, getApps } from 'firebase/app'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
```

- [ ] **Step 4: Create `src/lib/firebase/auth.ts`**

```typescript
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { app } from './config'

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)
export const signOutUser = () => signOut(auth)
```

- [ ] **Step 5: Create `src/lib/types/index.ts`**

```typescript
export type AccountType = 'credit' | 'bank' | 'cash'

export interface Account {
  id: string
  name: string
  type: AccountType
  last4digits?: string
  color: string
  isActive: boolean
}

export interface Category {
  id: string
  name: string
  monthlyTarget?: number
  color: string
  isActive: boolean
}

export type MatchType = 'contains' | 'exact' | 'startsWith'

export interface CategorizationRule {
  id: string
  keyword: string
  matchType: MatchType
  categoryId: string
  priority: number
  createdAt: string // ISO date string
}

export type TransactionSource = 'csv_import' | 'xlsx_import' | 'manual'

export interface Transaction {
  id: string
  date: string // ISO date string
  merchantName: string
  description?: string
  amount: number
  currency: string
  accountId: string
  categoryId?: string
  source: TransactionSource
  isImmediate: boolean
  month: string // YYYY-MM
}

export interface SalaryDeductions {
  incomeTax: number
  nationalInsurance: number
  healthInsurance: number
  pension: number
  trainingFund: number
}

export interface SalaryEntry {
  id: string
  month: string // YYYY-MM
  employerName: string
  grossAmount: number
  deductions: SalaryDeductions
  netAmount: number
  notes?: string
}

export interface IncomeEntry {
  id: string
  month: string // YYYY-MM
  sourceName: string
  amount: number
  date: string // ISO date string
  notes?: string
}

export interface InvestmentType {
  id: string
  name: string
  currency: string
  notes?: string
}

export interface InvestmentEntry {
  id: string
  date: string // ISO date string
  investmentTypeId: string
  amount: number
  currency: string
  notes?: string
}

export interface InvestmentConversion {
  id: string
  date: string // ISO date string
  investmentTypeId: string
  ilsReceived: number
  foreignAmountReduced?: number
  notes?: string
}

export interface Dividend {
  id: string
  month: string // YYYY-MM
  investmentTypeId: string
  amount: number
  currency: string
  ilsEquivalent?: number
  date: string // ISO date string
  notes?: string
}

export interface BankReconciliation {
  id: string
  month: string // YYYY-MM
  accountId: string
  actualBalance: number
  expectedBalance: number
  date: string // ISO date string
  notes?: string
}

export interface MonthlySettings {
  id: string
  month: string // YYYY-MM
  categoryTargets: Record<string, number> // categoryId → target amount
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/ .env.local.example
git commit -m "feat: add Firebase config and TypeScript types for all entities"
```

---

### Task 3: useAuth Hook (TDD)

**Files:**
- Create: `src/hooks/useAuth.test.ts`
- Create: `src/hooks/useAuth.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAuth.test.ts`:

```typescript
import { renderHook } from '@testing-library/react'

const mockUnsubscribe = jest.fn()
const mockOnAuthStateChanged = jest.fn()

jest.mock('@/lib/firebase/auth', () => ({ auth: {} }))
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    mockOnAuthStateChanged(callback)
    return mockUnsubscribe
  },
}))

import { useAuth } from './useAuth'

describe('useAuth', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockClear()
    mockUnsubscribe.mockClear()
  })

  it('starts with loading=true and user=null before Firebase responds', () => {
    mockOnAuthStateChanged.mockImplementation(() => {})
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('sets loading=false and user=null when not signed in', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => cb(null))
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('sets user when signed in', () => {
    const fakeUser = { uid: 'abc', email: 'test@test.com' }
    mockOnAuthStateChanged.mockImplementation((cb) => cb(fakeUser))
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toEqual(fakeUser)
    expect(result.current.loading).toBe(false)
  })

  it('calls unsubscribe on unmount', () => {
    mockOnAuthStateChanged.mockImplementation(() => {})
    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
pnpm test useAuth.test
```
Expected: FAIL — `Cannot find module './useAuth'`

- [ ] **Step 3: Implement `src/hooks/useAuth.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { user, loading }
}
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
pnpm test useAuth.test
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```powershell
git add src/hooks/
git commit -m "feat: add useAuth hook"
```

---

### Task 4: Hebrew RTL Dark Theme

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        accent: '#6366f1',
      },
      fontFamily: {
        sans: ['var(--font-rubik)', 'sans-serif'],
      },
    },
  },
}

export default config
```

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0f172a;
  --surface: #1e293b;
  --accent: #6366f1;
}

body {
  background-color: var(--background);
  color: #f1f5f9;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Replace `src/app/layout.tsx`**

```typescript
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
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-sans bg-background min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```powershell
git add src/app/layout.tsx src/app/globals.css tailwind.config.ts
git commit -m "feat: Hebrew RTL dark theme with Rubik font"
```

---

### Task 5: Login Page (TDD)

**Files:**
- Create: `src/app/(auth)/login/page.test.tsx`
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/(auth)/login/page.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockUseAuth = jest.fn()
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

const mockSignInWithGoogle = jest.fn()
jest.mock('@/lib/firebase/auth', () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
}))

import LoginPage from './page'

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockPush.mockClear()
    mockSignInWithGoogle.mockClear()
  })

  it('renders the Google sign-in button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('calls signInWithGoogle when button is clicked', () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /google/i }))
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('redirects to /dashboard when already signed in', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '123' }, loading: false })
    render(<LoginPage />)
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('does not redirect while auth state is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(<LoginPage />)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
pnpm test "login/page.test"
```
Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Create `src/app/(auth)/login/page.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signInWithGoogle } from '@/lib/firebase/auth'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Financial Track</h1>
        <p className="text-slate-400">מעקב פיננסי חודשי</p>
      </div>
      <button
        onClick={signInWithGoogle}
        className="w-full max-w-sm bg-accent hover:bg-indigo-500 text-white py-4 rounded-xl font-medium transition-colors"
      >
        כניסה עם Google
      </button>
    </main>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
pnpm test "login/page.test"
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(auth)/"
git commit -m "feat: add login page with Google OAuth"
```

---

### Task 6: BottomNav Component (TDD)

**Files:**
- Create: `src/components/layout/BottomNav.test.tsx`
- Create: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/BottomNav.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'

const mockUsePathname = jest.fn()
jest.mock('next/navigation', () => ({ usePathname: () => mockUsePathname() }))
jest.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('renders all five navigation items', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNav />)
    expect(screen.getByText('ראשי')).toBeInTheDocument()
    expect(screen.getByText('עסקאות')).toBeInTheDocument()
    expect(screen.getByText('ייבוא')).toBeInTheDocument()
    expect(screen.getByText('השקעות')).toBeInTheDocument()
    expect(screen.getByText('דוחות')).toBeInTheDocument()
  })

  it('applies accent color class to the active route', () => {
    mockUsePathname.mockReturnValue('/transactions')
    render(<BottomNav />)
    const activeLink = screen.getByText('עסקאות').closest('a')
    expect(activeLink).toHaveClass('text-accent')
  })

  it('applies muted color class to inactive routes', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNav />)
    const inactiveLink = screen.getByText('עסקאות').closest('a')
    expect(inactiveLink).toHaveClass('text-slate-400')
  })

  it('links point to correct hrefs', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<BottomNav />)
    expect(screen.getByText('ראשי').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('עסקאות').closest('a')).toHaveAttribute('href', '/transactions')
    expect(screen.getByText('ייבוא').closest('a')).toHaveAttribute('href', '/import')
    expect(screen.getByText('השקעות').closest('a')).toHaveAttribute('href', '/investments')
    expect(screen.getByText('דוחות').closest('a')).toHaveAttribute('href', '/reports')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
pnpm test BottomNav.test
```
Expected: FAIL — `Cannot find module './BottomNav'`

- [ ] **Step 3: Create `src/components/layout/BottomNav.tsx`**

```typescript
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
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
pnpm test BottomNav.test
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```powershell
git add src/components/
git commit -m "feat: add BottomNav component"
```

---

### Task 7: AuthGuard Component (TDD)

**Files:**
- Create: `src/components/layout/AuthGuard.test.tsx`
- Create: `src/components/layout/AuthGuard.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/AuthGuard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const mockUseAuth = jest.fn()
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))

import { AuthGuard } from './AuthGuard'

describe('AuthGuard', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('shows loading indicator while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(screen.getByText('טוען...')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('redirects to /login when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { uid: '123' }, loading: false })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(screen.getByText('Protected')).toBeInTheDocument()
  })

  it('does not redirect while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(<AuthGuard><div>Protected</div></AuthGuard>)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```powershell
pnpm test AuthGuard.test
```
Expected: FAIL — `Cannot find module './AuthGuard'`

- [ ] **Step 3: Create `src/components/layout/AuthGuard.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-slate-400">טוען...</p>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
```

- [ ] **Step 4: Run test — verify it passes**

```powershell
pnpm test AuthGuard.test
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```powershell
git add src/components/layout/
git commit -m "feat: add AuthGuard with redirect to /login"
```

---

### Task 8: Protected App Shell + Placeholder Screens

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/transactions/page.tsx`
- Create: `src/app/(app)/import/page.tsx`
- Create: `src/app/(app)/investments/page.tsx`
- Create: `src/app/(app)/reports/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/layout.tsx`**

```typescript
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
```

- [ ] **Step 2: Create placeholder pages**

Create `src/app/(app)/dashboard/page.tsx`:
```typescript
export default function DashboardPage() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">ראשי</h1>
    </main>
  )
}
```

Create `src/app/(app)/transactions/page.tsx`:
```typescript
export default function TransactionsPage() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">עסקאות</h1>
    </main>
  )
}
```

Create `src/app/(app)/import/page.tsx`:
```typescript
export default function ImportPage() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">ייבוא חודשי</h1>
    </main>
  )
}
```

Create `src/app/(app)/investments/page.tsx`:
```typescript
export default function InvestmentsPage() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">השקעות ודיבידנדים</h1>
    </main>
  )
}
```

Create `src/app/(app)/reports/page.tsx`:
```typescript
export default function ReportsPage() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">דוחות</h1>
    </main>
  )
}
```

- [ ] **Step 3: Replace `src/app/page.tsx`**

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
```

- [ ] **Step 4: Run all tests — verify everything still passes**

```powershell
pnpm test
```
Expected: PASS (all test suites, 15 tests total)

- [ ] **Step 5: Start dev server and smoke-test manually**

```powershell
pnpm dev
```

Open `http://localhost:3000` and verify:
- [ ] Redirects to `/login`
- [ ] Login page shows in Hebrew RTL, dark background, Rubik font
- [ ] "כניסה עם Google" button triggers Google OAuth popup
- [ ] After successful login, redirects to `/dashboard`
- [ ] BottomNav appears at the bottom with Hebrew labels
- [ ] Tapping each nav item navigates correctly
- [ ] All text is right-to-left

- [ ] **Step 6: Commit**

```powershell
git add "src/app/(app)/" src/app/page.tsx
git commit -m "feat: add protected app shell with bottom navigation and placeholder screens"
```

---

## Self-Review

**Spec coverage:**
- Hebrew RTL ✓ Task 4
- Dark theme (#0f172a, #1e293b, #6366f1) ✓ Task 4
- Firebase Auth with Google OAuth ✓ Tasks 2, 3, 5
- Bottom navigation (5 items) ✓ Task 6
- Protected routes (redirect to login) ✓ Tasks 7, 8
- TypeScript types for all Firestore entities ✓ Task 2
- Single-user only ✓ (Google OAuth, no multi-user setup)

**Type consistency:**
- `useAuth` returns `{ user: User | null, loading: boolean }` — used in `AuthGuard` and `LoginPage` ✓
- `auth`, `signInWithGoogle` exported from `@/lib/firebase/auth` — used consistently ✓
- `BottomNav`, `AuthGuard` are named exports — imported as `{ BottomNav }`, `{ AuthGuard }` ✓
