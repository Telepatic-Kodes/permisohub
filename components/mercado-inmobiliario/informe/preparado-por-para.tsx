"use client"

import { useState } from "react"

/**
 * Campo editable "preparado por/para" (INFO-04). Sin persistencia (ni
 * localStorage ni backend) — simple sobre prematuro, ver RESEARCH.md Open
 * Question 3. A diferencia de PrintButton, NO lleva `print:hidden`: este
 * campo debe verse tanto en pantalla como en el papel/PDF impreso, ya que
 * forma parte de la portada del informe, no de la barra de herramientas.
 */
export function PreparadoPorPara() {
  const [preparadoPor, setPreparadoPor] = useState("")
  const [preparadoPara, setPreparadoPara] = useState("")
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Preparado por</span>
        <input
          value={preparadoPor}
          onChange={(e) => setPreparadoPor(e.target.value)}
          placeholder="Nombre / empresa"
          className="border-b border-line-fine bg-transparent px-0.5 py-1 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Preparado para</span>
        <input
          value={preparadoPara}
          onChange={(e) => setPreparadoPara(e.target.value)}
          placeholder="Cliente / inversionista"
          className="border-b border-line-fine bg-transparent px-0.5 py-1 text-sm outline-none focus:border-primary"
        />
      </label>
    </div>
  )
}
