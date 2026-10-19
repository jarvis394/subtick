import type { CSSProperties } from 'react'
import { Toaster as Sonner } from 'sonner'

export const Toaster = () => (
  <Sonner
    position="bottom-right"
    closeButton
    style={
      {
        '--normal-bg': 'var(--surface)',
        '--normal-border': 'var(--border-strong)',
        '--normal-text': 'var(--foreground)',
        '--error-bg': 'var(--surface)',
        '--error-border': 'var(--border-strong)',
        '--error-text': 'var(--danger)',
        '--border-radius': '0.75rem',
      } as CSSProperties
    }
    toastOptions={{ classNames: { description: 'text-muted!' }, closeButton: false }}
  />
)
