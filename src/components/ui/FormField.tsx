interface Props {
  label: string
  htmlFor?: string
  error?: string | null
  children: React.ReactNode
  className?: string
}

export function FormField({ label, htmlFor, error, children, className }: Props) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-xs text-slate-400 block mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
