import { Suspense } from 'react'
import { ImportHub } from '@/components/import/ImportHub'

export default function ImportPage() {
  return (
    <Suspense>
      <ImportHub />
    </Suspense>
  )
}
