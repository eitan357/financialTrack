export type Validator = (value: string) => string | null

export const required = (): Validator =>
  (v) => !v?.trim() ? 'שדה חובה' : null

export const positiveAmount = (): Validator =>
  (v) => !v || parseFloat(v) <= 0 ? 'יש להזין סכום חיובי' : null

export const requiredSelect = (): Validator =>
  (v) => !v ? 'יש לבחור ערך' : null

export function runValidator(value: string, validators: Validator[]): string | null {
  for (const fn of validators) {
    const err = fn(value)
    if (err) return err
  }
  return null
}
