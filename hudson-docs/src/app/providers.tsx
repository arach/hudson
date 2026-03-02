'use client'

import { DeweyProvider } from '@arach/dewey'
import { providerProps } from '@/lib/dewey'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DeweyProvider {...providerProps}>
      {children}
    </DeweyProvider>
  )
}
