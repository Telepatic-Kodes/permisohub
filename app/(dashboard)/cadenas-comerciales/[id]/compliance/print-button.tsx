'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-lg bg-[#1A3328] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1A3328]/90"
    >
      <Printer className="size-4" />
      Imprimir
    </button>
  )
}
