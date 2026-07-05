# Swipe Import Flow — Design Spec

## Goal

Replace the table-based review step in BankFlow and CreditFlow with a Tinder-style swipe card interface: one transaction per card, swipe right to approve, swipe left to skip. The new interface is faster, more focused, and includes light gamification.

## Scope

**Redesigned:** `BankFlow`, `CreditFlow` — the table review UI only.
**Unchanged:** `SalaryFlow`, `CashFlow` (manual entry, different UX). All parsing, categorization, duplicate detection, and Firestore logic stays exactly as-is.

---

## Architecture

### New Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `SwipeImportDeck` | `src/components/import/SwipeImportDeck.tsx` | Orchestrates the full swipe experience: state, undo stack, points, HUD |
| `SwipeableCard` | `src/components/import/SwipeableCard.tsx` | Single swipeable card with drag gesture and overlay animations |
| `ImportHUD` | `src/components/import/ImportHUD.tsx` | Header: progress bar, points, income/expense totals |
| `ImportTutorial` | `src/components/import/ImportTutorial.tsx` | First-time overlay tutorial (3 steps) |

`BankFlow` and `CreditFlow` replace their `<table>` blocks with `<SwipeImportDeck rows={rows} ... />` after file parsing. Everything else in those components (file upload, parsing, save logic) stays.

---

## Card Order

1. **Uncategorized expenses** — `direction === 'expense'` and no `categoryId` and no `portfolioAccountId` and `!skip`
2. **All other active rows** — sorted by date ascending
3. **Auto-skipped rows** — `skip === true` (shown last, faded, still swipeable to restore)

---

## SwipeImportDeck — State

```ts
type CardStatus = 'pending' | 'approved' | 'skipped'

interface DeckCard extends BankImportRow {
  status: CardStatus
}

interface UndoEntry {
  index: number          // index in cards array
  previous: DeckCard     // full previous state
}

state:
  cards: DeckCard[]
  currentIndex: number   // index of top card in deck
  undoStack: UndoEntry[] // max 5 entries
  points: number
  streakCount: number    // consecutive swipes without editing, for streak bonus
```

All card edits are committed to local state immediately. `currentIndex` advances after each swipe. The deck is complete when `currentIndex >= cards.length`.

---

## SwipeableCard — Gesture & Animation

### Drag Behavior
- Implement with `@use-gesture/react` (`useDrag` hook). If not yet installed, add it.
- Threshold: **60px horizontal drag** triggers the action on release.
- Below threshold: card snaps back to center with a spring animation.

### Visual During Drag
- Card rotates slightly: `rotate(drag_x / 20)deg`, capped at ±15°.
- **Right drag:** green semi-transparent overlay fades in, showing a filled circle with a white ✓ checkmark (no text).
- **Left drag:** red semi-transparent overlay fades in, showing a filled circle with a white trash icon (🗑 via Lucide `Trash2`).
- Overlay opacity scales from 0 → 0.9 as drag goes from 0 → 120px.

### On Release (threshold met)
- Card flies off screen in drag direction (300ms ease-in).
- Next card animates up from behind (scale 0.95 → 1.0, translateY 8px → 0).
- Points popup appears (see Points section below).

### Behind-Card Peek
- At all times, the next card is visible behind the active card: `scale(0.95) translateY(8px)`, no interaction, showing only merchant name + amount + date. Max 2 cards visible in stack.

### Action Buttons (below deck)
For accessibility and desktop users — same actions as swipe:
```
[← עסקה קודמת]    [✗ דלג]    [✓ אשר]
```
- **← עסקה קודמת** — undo last swipe (active only if undoStack.length > 0)
- **✗ דלג** — same as swipe left
- **✓ אשר** — same as swipe right

---

## Card Content Layout

Each card shows all editable fields directly. No expand/collapse. No "edit" button.

```
┌──────────────────────────────────────────┐
│  🏪 מקדונלד'ס                           │
│  24.06.2026                  45.00 ₪    │
│  ──────────────────────────────────────  │
│                                          │
│  קטגוריה                                │
│  [⚠️ לא מוגדרת              ▼]          │  ← SelectField, full width, prominent
│                                          │
│  כיוון                                  │
│  [  הוצאה  ] [  הכנסה  ]               │  ← DirectionToggle
│                                          │
│  [  חיוב מיידי  ]                       │  ← toggle button, full-width pill
│                                          │
│  הערה                                   │
│  [________________________________]     │
│                                          │
│  השקעה                                  │
│  [——                            ▼]      │  ← InvestmentPicker (hidden if no portfolios)
│                                          │
└──────────────────────────────────────────┘
```

### "חיוב מיידי" Toggle Button
A full-width pill button (not a checkbox). Two visual states:

- **Inactive:** `border border-slate-600 text-slate-400 bg-transparent rounded-full py-2 text-sm` — looks like a quiet option.
- **Active:** `bg-amber-500/20 border border-amber-500 text-amber-400 rounded-full py-2 text-sm font-semibold` — clearly activated.

Tapping toggles `isImmediate` in card state.

### Category Field Prominence
- If no category set: border `ring-1 ring-amber-400`, placeholder "⚠️ לא מוגדרת" in amber.
- If set: normal styling with colored dot (using existing `SelectField` color support).

### InvestmentPicker
Only shown if `portfolioAccounts.length > 0`. Hidden entirely otherwise to keep the card clean.

---

## HUD (ImportHUD)

Fixed header below the nav back button. Updates on every card state change.

```
┌──────────────────────────────────────────┐
│  ← לאומי — יוני 2026       [?] [שמור N] │
│  ████████████████░░░░░  23 / 42          │
│  ★ 47 נקודות                            │
│  הוצאות ₪8,400  ·  הכנסות ₪12,500  ·  נטו ₪4,100│
└──────────────────────────────────────────┘
```

- **Progress bar:** `approved + skipped` / `total cards`. Green fill.
- **Points:** Star icon (★ from Lucide `Star`), no currency symbol.
- **Totals:** Sum of `amount` for all `approved` cards by direction. Investment rows counted by direction (expense if transfer out, income if transfer in). Updates live.
- **[שמור N]:** Button showing count of `approved` cards. Always visible. Triggers save without requiring deck completion.

---

## Points System

Points are **display-only** — no persistence to Firestore. Reset when the user navigates away.

| Action | Points | Timing |
|--------|--------|--------|
| Swipe right (approve) | +2 | On swipe |
| Swipe left (skip) | +1 | On swipe |
| Streak bonus: 5 consecutive swipes (right or left) | +5 | On 5th swipe |
| Completing all cards | +20 | After last card |

**No points for form editing mid-card** — points fire only on swipe. This keeps the popup from interrupting editing flow and ensures it only appears at the natural "transition" moment.

### Points Popup
- Small floating chip: `★ +2` animates up from the bottom of the card and fades out in 800ms.
- Does not block interaction — it's `pointer-events: none`, positioned absolute above the deck.
- Streak milestone: chip shows `★ +5 רצף! 🔥` in orange.

---

## Undo

- Stack holds up to **5 entries**.
- Each entry records `{ index, previousCardState }`.
- Undo: pops the stack, restores card to its previous state and status, sets `currentIndex` back to that card (it returns to the top of the deck with a slide-in-from-side animation).
- Points are **not reversed** on undo (no negative surprise for the user).

---

## Tutorial (ImportTutorial)

Shown **once per device** via `localStorage` key `import-swipe-tutorial-v1`. The `[?]` button in the HUD re-shows it.

Three animated slides, each with a visual demo:

1. Green card flies right, circle ✓ icon → **"החלק ימינה לאישור העסקה"**
2. Red card flies left, circle Trash2 icon → **"החלק שמאלה לדילוג על העסקה"**
3. Static card with form fields highlighted → **"ערוך פרטים ישירות על הכרטיסיה לפני האישור"**

"הבנתי!" button dismisses, saves flag to localStorage.

---

## Deck Complete State

When `currentIndex >= cards.length` (all cards processed):

```
┌──────────────────────────────────────────┐
│            ✓  סיימת!                    │
│         ★ 89 נקודות                     │
│                                          │
│    [  שמור ויבא 29 עסקאות  ]            │  ← primary, accent color
│    [  עבור לעמוד עסקאות   ]            │  ← secondary, slate border
└──────────────────────────────────────────┘
```

- **"שמור ויבא N עסקאות"** — calls existing save logic (`addTransactions`), then navigates to transaction list.
- **"עבור לעמוד עסקאות"** — navigates to `/transactions` without saving (if user already saved via the HUD button mid-flow).
- No summary screen. The transactions page is the source of truth.

---

## Save Logic (unchanged)

The save button (`שמור N`) calls the existing `handleSave()` in BankFlow/CreditFlow, which uses `approved` cards (those with `status === 'approved'`). The duplicate detection and Firestore write stay identical.

`skip` in the existing `BankImportRow` interface maps to `status === 'skipped'`.

---

## What Does NOT Change

- File upload UI
- File parsing (`parseLeumiPdf`, `parseOneZeroXlsx`, `parseCSV`, `mapRows`)
- `suggestSkips()` — runs before rendering the deck, pre-populates card statuses
- `categorize()` — runs on parse, pre-populates `categoryId`
- `detectDuplicates()` — called on save
- `addTransactions()` — called on save
- SalaryFlow, CashFlow — untouched
- All TypeScript types

---

## Dependencies to Add

- `@use-gesture/react` — touch/mouse drag gestures
