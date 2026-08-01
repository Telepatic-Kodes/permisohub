"use client"

import { memo, type ReactNode } from "react"

// Port de components/MarkdownRenderer.tsx (repo origen PROPRA·BI) — fase 5
// de la fusión (pasada de calidad visual). Sin dependencia nueva (no
// react-markdown/remark): las 3 páginas que lo usan (tasación, pricing,
// due-diligence) ya restringen el prompt a un subconjunto angosto de
// markdown (## / ### , **bold**, listas -/1., tablas, links) — mismo
// trade-off que el resto del repo ya acepta para RSS/HTML hand-rolled.
//
// Antes de este componente, las 3 páginas renderizaban el texto de streaming
// crudo en un <div style={{whiteSpace:'pre-wrap'}}> — "##", "**" y las
// tablas markdown aparecían literalmente en pantalla (confirmado con
// captura real vía Playwright, 1 ago 2026). Colores adaptados de las
// variables del origen (--gold/--text/--muted) a las de PermisoHub
// (text-primary/text-muted-foreground/border-line-fine).

interface MarkdownRendererProps {
  content: string
}

type LineGroup = string | string[]

function groupTableRows(lines: string[]): LineGroup[] {
  const groups: LineGroup[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
      const tableRows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableRows.push(lines[i])
        i++
      }
      groups.push(tableRows)
    } else {
      groups.push(lines[i])
      i++
    }
  }
  return groups
}

// Pre-procesa pipes dentro de URLs en links markdown para que no se
// confundan con separadores de columna de tabla — tolera un nivel de
// paréntesis dentro de la URL (ej. enlaces de Wikipedia).
function escapePipesInLinks(content: string): string {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]*(?:\([^)]*\)[^\s)]*)*)\)/g
  return content.replace(linkRe, (_match, text: string, url: string) => {
    const safeUrl = url.replace(/\|/g, "%7C")
    return `[${text}](${safeUrl})`
  })
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\((?:[^)(]|\([^)]*\))+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-primary">
          {part.slice(2, -2)}
        </strong>
      )
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(((?:[^)(]|\([^)]*\))+)\)$/)
    if (linkMatch) {
      const rawUrl = linkMatch[2].trim()
      const safeUrl = /^(https?:|mailto:|\/|#)/i.test(rawUrl) ? rawUrl : "#"
      return (
        <a
          key={i}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--blueprint)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return part
  })
}

function MarkdownRendererBase({ content }: MarkdownRendererProps) {
  const safeContent = escapePipesInLinks(content)
  const groups = groupTableRows(safeContent.split("\n"))
  const elements: ReactNode[] = []
  let key = 0

  for (const item of groups) {
    if (Array.isArray(item)) {
      const rows = item.map((row) => row.trim().slice(1, -1).split("|").map((cell) => cell.trim()))
      const dataRows = rows.filter((row) => !row.every((cell) => /^[-: ]+$/.test(cell)))
      if (dataRows.length === 0) continue
      const [headerRow, ...bodyRows] = dataRows
      elements.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {headerRow.map((cell, ci) => (
                  <th
                    key={`th-${ci}`}
                    className="whitespace-nowrap border border-line-fine bg-[var(--blueprint-soft)] px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--blueprint)]"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={`tr-${ri}`} className="border-b border-line-fine">
                  {row.map((cell, ci) => (
                    <td
                      key={`td-${ri}-${ci}`}
                      className={`border border-line-fine px-3 py-1.5 leading-relaxed ${
                        ci === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const line = item

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={key++}
          className="font-technical mt-5 mb-2.5 border-b border-[var(--blueprint-soft)] pb-1.5 text-[13px] font-semibold uppercase tracking-wide text-[var(--blueprint)]"
        >
          {line.slice(3)}
        </h2>,
      )
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mt-3.5 mb-1.5 text-[13px] font-semibold text-foreground">
          {renderInline(line.slice(4))}
        </h3>,
      )
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s(.*)$/)
      if (num) {
        elements.push(
          <div key={key++} className="mb-1.5 flex gap-2.5">
            <span className="min-w-[16px] font-semibold text-[var(--blueprint)]">{num[1]}.</span>
            <span className="text-sm leading-relaxed text-foreground/90">{renderInline(num[2])}</span>
          </div>,
        )
      }
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={key++} className="mb-1.5 flex gap-2.5">
          <span className="mt-px text-[var(--blueprint)]">›</span>
          <span className="text-sm leading-relaxed text-foreground/90">{renderInline(line.slice(2))}</span>
        </div>,
      )
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1.5" />)
    } else {
      elements.push(
        <p key={key++} className="mb-1.5 text-sm leading-relaxed text-foreground/90">
          {renderInline(line)}
        </p>,
      )
    }
  }

  return <div>{elements}</div>
}

export const MarkdownRenderer = memo(MarkdownRendererBase)
