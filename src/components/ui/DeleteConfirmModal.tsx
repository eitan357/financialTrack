'use client'
import React from 'react'
import { Trash2 } from 'lucide-react'

interface Props {
  title: string
  itemName: string
  warningBody: React.ReactNode
  hideWarning?: string
  hideLabel?: string
  onHide?: () => void
  onDelete: () => void
  onCancel: () => void
  deleting: boolean
}

export function DeleteConfirmModal({
  title, itemName, warningBody, hideWarning, hideLabel = 'הסתר (מומלץ)',
  onHide, onDelete, onCancel, deleting,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onCancel}>
      <div className="bg-surface rounded-t-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-900/40 rounded-full flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-slate-400" dir="auto">{itemName}</p>
          </div>
        </div>
        <p className="text-sm text-slate-300">{warningBody}</p>
        {hideWarning && (
          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3">
            <p className="text-amber-400 text-xs font-medium mb-1">💡 שקול להסתיר במקום למחוק</p>
            <p className="text-slate-400 text-xs">{hideWarning}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {onHide && (
            <button onClick={onHide}
              className="w-full py-3 bg-amber-900/20 text-amber-400 border border-amber-800/40 rounded-xl text-sm font-medium">
              {hideLabel}
            </button>
          )}
          <button onClick={onDelete} disabled={deleting}
            className="w-full py-3 bg-red-900/30 text-red-400 border border-red-800/40 rounded-xl text-sm font-medium disabled:opacity-50">
            {deleting ? 'מוחק...' : 'מחק לצמיתות'}
          </button>
          <button onClick={onCancel} className="w-full py-2 text-slate-400 text-sm">ביטול</button>
        </div>
      </div>
    </div>
  )
}
